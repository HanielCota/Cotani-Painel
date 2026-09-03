import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { cancelMercadoPagoSubscription, createSubscriptionCheckout } from "@/server/services/mercado-pago";
import { isSubscriptionActive } from "@/server/subscription";
import { getApiTenant } from "@/server/tenant";
import { ensureCurrentAppUser } from "@/server/auth";

const checkoutSchema = z.object({
  plan: z.enum([SubscriptionPlan.ESSENTIAL, SubscriptionPlan.PROFESSIONAL]),
  cycle: z.enum([BillingCycle.MONTHLY, BillingCycle.ANNUAL]),
});

export async function POST(request: NextRequest) {
  try {
    const tenant = await getApiTenant(["ADMIN"]);
    if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
    const { clinic } = tenant.context;
    const { appUser: user } = await ensureCurrentAppUser();

    let body: unknown;
    try {
      const rawBody = await readRequestText(request, 8 * 1024);
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ message: "Corpo da requisição muito grande." }, { status: 413 });
      }
      return NextResponse.json({ message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Plano inválido. Escolha mensal ou anual." }, { status: 400 });
    }

    if (!user?.email) {
      return NextResponse.json({ message: "Sua conta precisa ter um e-mail válido para iniciar o checkout." }, { status: 400 });
    }

    const payerEmail = user.email;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const backUrl = appUrl
      ? `${appUrl.replace(/\/$/, "")}/dashboard/assinatura`
      : `${request.nextUrl.origin}/dashboard/assinatura`;

    const checkoutAttempt = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription:${clinic.id}`}))`;
      const current = await transaction.clinic.findUniqueOrThrow({ where: { id: clinic.id } });
      if (current.hasPaidOnce && isSubscriptionActive(current)) {
        throw new Error("Sua assinatura ainda está ativa. Alterações de plano ficam disponíveis após o período atual ou pelo suporte.");
      }

      const maxProfessionals = getPlanEntitlements(parsed.data.plan).maxProfessionals;
      if (maxProfessionals !== null) {
        const activeProfessionals = await transaction.professional.count({
          where: { clinicId: clinic.id, isActive: true },
        });
        if (activeProfessionals > maxProfessionals) {
          throw new Error(
            `O plano escolhido permite até ${maxProfessionals} ${maxProfessionals === 1 ? "profissional ativo" : "profissionais ativos"}. Desative os excedentes antes de mudar de plano.`,
          );
        }
      }

      const reusableAfter = new Date(Date.now() - 30 * 60_000);
      if (
        current.mercadoPagoSubscriptionId
        && current.mercadoPagoCheckoutUrl
        && current.mercadoPagoCheckoutStartedAt
        && current.mercadoPagoCheckoutStartedAt > reusableAfter
        && current.pendingSubscriptionPlan === parsed.data.plan
        && current.pendingSubscriptionCycle === parsed.data.cycle
      ) {
        return { resumeUrl: current.mercadoPagoCheckoutUrl, previousSubscriptionId: null, idempotencyKey: current.mercadoPagoCheckoutKey ?? randomUUID() };
      }
      const idempotencyKey = current.mercadoPagoCheckoutKey
        && current.mercadoPagoCheckoutStartedAt
        && current.mercadoPagoCheckoutStartedAt > reusableAfter
        ? current.mercadoPagoCheckoutKey
        : randomUUID();

      await transaction.clinic.update({
        where: { id: clinic.id },
        data: {
          mercadoPagoCheckoutKey: idempotencyKey,
          mercadoPagoCheckoutStartedAt: new Date(),
          pendingSubscriptionPlan: parsed.data.plan,
          pendingSubscriptionCycle: parsed.data.cycle,
        },
      });
      return { idempotencyKey, resumeUrl: null, previousSubscriptionId: current.mercadoPagoSubscriptionId };
    });

    if (checkoutAttempt.resumeUrl) return NextResponse.json({ checkoutUrl: checkoutAttempt.resumeUrl, resumed: true });

    if (checkoutAttempt.previousSubscriptionId) {
      try {
        await cancelMercadoPagoSubscription(checkoutAttempt.previousSubscriptionId);
      } catch (error) {
        logger.warn("Não foi possível cancelar checkout anterior; uma nova tentativa será criada", { clinicId: clinic.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const { checkoutUrl, mercadoPagoSubscriptionId } = await createSubscriptionCheckout({
      clinicId: clinic.id,
      plan: parsed.data.plan,
      cycle: parsed.data.cycle,
      idempotencyKey: checkoutAttempt.idempotencyKey,
      payerEmail,
      backUrl,
    });

    await prisma.clinic.update({
      where: { id: clinic.id, mercadoPagoCheckoutKey: checkoutAttempt.idempotencyKey },
      data: {
        mercadoPagoSubscriptionId,
        mercadoPagoCheckoutUrl: checkoutUrl,
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : String(error);
    const isBusinessConflict = internalMessage.startsWith("Sua assinatura ainda") || internalMessage.startsWith("O plano escolhido permite");
    const publicMessage = isBusinessConflict
      ? internalMessage
      : "Não foi possível iniciar o checkout. Tente novamente.";
    logger.error("Falha ao criar checkout de assinatura", {
      error: internalMessage,
    });

    return NextResponse.json(
      {
        message: publicMessage,
      },
      { status: isBusinessConflict ? 409 : 500 },
    );
  }
}
