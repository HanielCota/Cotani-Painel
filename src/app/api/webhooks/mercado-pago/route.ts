import type { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import { getPlanPrice } from "@/config/subscription-plans";
import {
  getInvoiceFromMercadoPago,
  getPlanConfig,
  syncSubscriptionFromMercadoPago,
  subscriptionPeriodEnd,
  validateMercadoPagoWebhook,
} from "@/server/services/mercado-pago";

interface MercadoPagoWebhookBody {
  id?: string | number;
  action?: string;
  type?: string;
  data?: { id?: string | number };
}

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  let body: MercadoPagoWebhookBody;
  try {
    const rawBody = await readRequestText(request, MAX_WEBHOOK_BODY_BYTES);
    body = rawBody ? JSON.parse(rawBody) as MercadoPagoWebhookBody : {};
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ message: "Corpo do webhook muito grande." }, { status: 413 });
    }
    body = {};
  }

  const dataId = String(body.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? "").trim();
  const eventType = String(body.type ?? request.nextUrl.searchParams.get("type") ?? "").trim();
  const action = String(body.action ?? request.nextUrl.searchParams.get("action") ?? eventType).trim();
  const notificationId = body.id ? String(body.id) : undefined;
  const xRequestId = request.headers.get("x-request-id");

  if (!dataId || !eventType) {
    return NextResponse.json({ message: "Evento sem data.id ou type." }, { status: 400 });
  }

  try {
    validateMercadoPagoWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId,
      dataId,
    });
  } catch (error) {
    logger.error("Assinatura do webhook Mercado Pago inválida", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 401 });
  }

  // O ID da notificação é único. O recurso não é: uma assinatura recebe
  // diversas atualizações e cobranças ao longo de sua vida.
  const eventId = notificationId ?? `${action}:${dataId}:${xRequestId ?? "sem-request-id"}`;
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "mercado-pago", eventId } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ received: true, skipped: true });

  try {
    if (eventType === "subscription_preapproval") {
      const synced = await syncSubscriptionFromMercadoPago({ mercadoPagoSubscriptionId: dataId });

      await prisma.$transaction(async (tx) => {
        const clinic = await tx.clinic.findFirst({
          where: {
            OR: [
              { mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId },
              ...(synced.externalReference ? [{ id: synced.externalReference }] : []),
            ],
          },
        });
        if (!clinic) {
          throw new Error("Assinatura do Mercado Pago ainda não vinculada; evento será repetido.");
        }

        const selectedPlan = clinic.pendingSubscriptionPlan ?? clinic.subscriptionPlan;
        const selectedCycle = clinic.pendingSubscriptionCycle ?? clinic.subscriptionCycle;
        if (synced.planId && selectedPlan && selectedCycle && synced.planId !== getPlanConfig(selectedPlan, selectedCycle).mercadoPagoPlanId) {
          throw new Error("Plano recebido do Mercado Pago não corresponde ao catálogo da clínica.");
        }

        const subscriptionApproved = synced.status === "ACTIVE";
        const canceledWithPaidAccess = synced.status === "CANCELED" && clinic.cancelAtPeriodEnd && clinic.subscriptionExpiresAt && clinic.subscriptionExpiresAt > new Date();
        const effectiveExpiration = subscriptionApproved ? subscriptionPeriodEnd(selectedCycle, synced.nextPaymentDate) : undefined;
        await tx.clinic.update({
          where: { id: clinic.id },
          data: {
            mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId,
            subscriptionStatus: canceledWithPaidAccess ? "ACTIVE" : synced.status ?? undefined,
            hasPaidOnce: synced.hasPaidOnce || clinic.hasPaidOnce,
            subscriptionExpiresAt: effectiveExpiration,
            subscriptionPlan: subscriptionApproved ? selectedPlan : undefined,
            subscriptionCycle: subscriptionApproved ? selectedCycle : undefined,
            pendingSubscriptionPlan: subscriptionApproved ? null : undefined,
            pendingSubscriptionCycle: subscriptionApproved ? null : undefined,
            mercadoPagoCheckoutUrl: subscriptionApproved ? null : undefined,
            cancelAtPeriodEnd: canceledWithPaidAccess ? true : subscriptionApproved ? false : undefined,
          },
        });
        await tx.clinic.updateMany({
          where: { billingOwnerId: clinic.id },
          data: {
            subscriptionStatus: canceledWithPaidAccess ? "ACTIVE" : synced.status ?? undefined,
            hasPaidOnce: synced.hasPaidOnce || clinic.hasPaidOnce,
            subscriptionExpiresAt: effectiveExpiration,
            subscriptionPlan: subscriptionApproved ? selectedPlan : undefined,
            subscriptionCycle: subscriptionApproved ? selectedCycle : undefined,
            cancelAtPeriodEnd: canceledWithPaidAccess ? true : subscriptionApproved ? false : undefined,
          },
        });

        await tx.webhookEvent.create({
          data: { provider: "mercado-pago", eventId, type: action, payloadSnapshot: body as Prisma.InputJsonValue },
        });
      });
    } else if (eventType === "subscription_authorized_payment") {
      const invoice = await getInvoiceFromMercadoPago(dataId);
      const synced = await syncSubscriptionFromMercadoPago({ mercadoPagoSubscriptionId: invoice.subscriptionId });

      await prisma.$transaction(async (tx) => {
        const clinic = await tx.clinic.findFirst({
          where: { OR: [{ mercadoPagoSubscriptionId: invoice.subscriptionId }, ...(synced.externalReference ? [{ id: synced.externalReference }] : [])] },
        });
        if (!clinic) throw new Error("Fatura sem clínica vinculada.");
        const selectedPlan = clinic.pendingSubscriptionPlan ?? clinic.subscriptionPlan;
        const selectedCycle = clinic.pendingSubscriptionCycle ?? clinic.subscriptionCycle;
        if (!selectedPlan || !selectedCycle) throw new Error("Fatura sem plano local pendente para conciliação.");
        if (synced.planId && synced.planId !== getPlanConfig(selectedPlan, selectedCycle).mercadoPagoPlanId) throw new Error("Plano da fatura diverge do catálogo local.");
        const expectedAmount = getPlanPrice(selectedPlan, selectedCycle);
        if (Math.abs(invoice.amount - expectedAmount) > 0.01) throw new Error("Valor da fatura diverge do catálogo local.");

        await tx.paymentHistory.upsert({
          where: { mercadoPagoPaymentId: invoice.paymentId },
          create: {
            clinicId: clinic.id,
            amount: invoice.amount,
            status: invoice.status,
            plan: clinic.pendingSubscriptionPlan ?? clinic.subscriptionPlan,
            billingCycle: clinic.pendingSubscriptionCycle ?? clinic.subscriptionCycle,
            mercadoPagoPaymentId: invoice.paymentId,
            mercadoPagoSubscriptionId: invoice.subscriptionId,
            paidAt: invoice.paidAt,
          },
          update: { amount: invoice.amount, status: invoice.status, paidAt: invoice.paidAt },
        });

        if (invoice.status === "approved") {
          const effectiveExpiration = subscriptionPeriodEnd(selectedCycle, synced.nextPaymentDate, invoice.paidAt);
          await tx.clinic.update({
            where: { id: clinic.id },
            data: {
              subscriptionStatus: "ACTIVE",
              hasPaidOnce: true,
              mercadoPagoSubscriptionId: invoice.subscriptionId,
              subscriptionPlan: selectedPlan,
              subscriptionCycle: selectedCycle,
              subscriptionExpiresAt: effectiveExpiration,
              pendingSubscriptionPlan: null,
              pendingSubscriptionCycle: null,
              mercadoPagoCheckoutUrl: null,
              cancelAtPeriodEnd: false,
            },
          });
          await tx.clinic.updateMany({
            where: { billingOwnerId: clinic.id },
            data: {
              subscriptionStatus: "ACTIVE",
              hasPaidOnce: true,
              subscriptionPlan: selectedPlan,
              subscriptionCycle: selectedCycle,
              subscriptionExpiresAt: effectiveExpiration,
              cancelAtPeriodEnd: false,
            },
          });
        }

        await tx.webhookEvent.create({
          data: { provider: "mercado-pago", eventId, type: action, payloadSnapshot: body as Prisma.InputJsonValue },
        });
      });
    } else {
      await prisma.webhookEvent.create({
        data: { provider: "mercado-pago", eventId, type: action, payloadSnapshot: body as Prisma.InputJsonValue },
      });
      logger.info("Tipo de evento do Mercado Pago ignorado", { eventType, action, dataId });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ received: true, skipped: true });

    logger.error("Falha ao processar evento do webhook Mercado Pago", {
      eventId,
      eventType,
      action,
      dataId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ message: "Falha ao processar evento do webhook." }, { status: 500 });
  }
}
