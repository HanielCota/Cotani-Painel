import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { assertPlanFits } from "@/server/services/billing-access";
import { cancelMercadoPagoSubscription, createSubscriptionCheckout, getPlanConfig } from "@/server/services/mercado-pago";
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
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      const current = await transaction.clinic.findUniqueOrThrow({ where: { id: clinic.id } });
      if (current.billingOwnerId) throw new Error("O plano escolhido deve ser contratado pela unidade principal.");
      if (current.hasPaidOnce && isSubscriptionActive(current)) {
        throw new Error("Sua assinatura ainda está ativa. Alterações de plano ficam disponíveis após o período atual ou pelo suporte.");
      }
      await assertPlanFits(transaction, clinic.id, parsed.data.plan);
      let pending = current.mercadoPagoCheckoutKey
        ? await transaction.billingContract.findUnique({ where: { id: current.mercadoPagoCheckoutKey } }) : null;
      // Attempts from the former associated-plan flow failed before a remote
      // subscription was created. A fresh key is required because the old
      // idempotency key was already submitted with a different request body.
      if (pending?.state === "CREATING" && pending.remotePlanId) {
        await transaction.billingContract.update({ where: { id: pending.id }, data: { state: "FAILED" } });
        pending = null;
      }
      if (pending?.state === "CREATING") {
        if (current.mercadoPagoCheckoutStartedAt && Date.now() - current.mercadoPagoCheckoutStartedAt.getTime() > 24 * 60 * 60_000) {
          throw new Error("O plano escolhido possui uma tentativa antiga sem confirmação. Contate o suporte para conciliar antes de tentar novamente.");
        }
        if (pending.plan !== parsed.data.plan || pending.cycle !== parsed.data.cycle) {
          throw new Error("O plano escolhido difere de uma tentativa ainda em processamento. Retome a tentativa anterior antes de trocar.");
        }
        return { contract: pending, previousSubscriptionId: current.mercadoPagoSubscriptionId, resumeUrl: null };
      }
      if (pending?.checkoutUrl && current.mercadoPagoCheckoutUrl
        && (pending.state === "pending" || pending.state === "authorized")
        && pending.plan === parsed.data.plan && pending.cycle === parsed.data.cycle) {
        return { contract: pending, previousSubscriptionId: null, resumeUrl: pending.checkoutUrl };
      }
      const config = getPlanConfig(parsed.data.plan, parsed.data.cycle);
      const contract = await transaction.billingContract.create({ data: {
        id: randomUUID(), clinicId: clinic.id, plan: parsed.data.plan, cycle: parsed.data.cycle,
        amount: config.price, remotePlanId: null,
      } });
      await transaction.clinic.update({ where: { id: clinic.id }, data: {
        mercadoPagoCheckoutKey: contract.id, mercadoPagoCheckoutStartedAt: new Date(),
        mercadoPagoCheckoutUrl: null, pendingSubscriptionPlan: contract.plan, pendingSubscriptionCycle: contract.cycle,
      } });
      return { contract, resumeUrl: null, previousSubscriptionId: current.mercadoPagoSubscriptionId };
    });

    if (checkoutAttempt.resumeUrl) return NextResponse.json({ checkoutUrl: checkoutAttempt.resumeUrl, resumed: true });

    if (checkoutAttempt.previousSubscriptionId) {
      await cancelMercadoPagoSubscription(checkoutAttempt.previousSubscriptionId);
    }

    const { checkoutUrl, mercadoPagoSubscriptionId } = await createSubscriptionCheckout({
      clinicId: clinic.id,
      plan: parsed.data.plan,
      cycle: parsed.data.cycle,
      idempotencyKey: checkoutAttempt.contract.id,
      payerEmail,
      backUrl,
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      await tx.clinic.update({
        where: { id: clinic.id, mercadoPagoCheckoutKey: checkoutAttempt.contract.id },
        data: { mercadoPagoSubscriptionId, mercadoPagoCheckoutUrl: checkoutUrl, cancelAtPeriodEnd: false },
      });
      await tx.billingContract.update({ where: { id: checkoutAttempt.contract.id },
        data: { remoteId: mercadoPagoSubscriptionId, checkoutUrl, state: "pending" } });
    });
    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const conflict = message.startsWith("Sua assinatura ainda") || message.startsWith("O plano escolhido");
    logger.error("Falha ao criar checkout de assinatura", { error: message });
    return NextResponse.json({ message: conflict ? message : "Não foi possível iniciar o checkout. Tente novamente." }, { status: conflict ? 409 : 500 });
  }
}
