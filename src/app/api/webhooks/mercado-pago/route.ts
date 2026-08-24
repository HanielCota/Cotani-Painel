import type { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  getInvoiceFromMercadoPago,
  syncSubscriptionFromMercadoPago,
  validateMercadoPagoWebhook,
} from "@/server/services/mercado-pago";

interface MercadoPagoWebhookBody {
  id?: string | number;
  action?: string;
  type?: string;
  data?: { id?: string | number };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  let body: MercadoPagoWebhookBody;
  try {
    body = (await request.json()) as MercadoPagoWebhookBody;
  } catch {
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
        const clinic = await tx.clinic.findUnique({
          where: { mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId },
        });
        if (!clinic) {
          logger.warn("Assinatura do Mercado Pago não vinculada a nenhuma clínica", {
            mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId,
          });
        } else {
          await tx.clinic.update({
            where: { id: clinic.id },
            data: {
              subscriptionStatus: synced.status,
              hasPaidOnce: synced.hasPaidOnce || clinic.hasPaidOnce,
              subscriptionExpiresAt: synced.nextPaymentDate,
            },
          });
        }

        await tx.webhookEvent.create({
          data: { provider: "mercado-pago", eventId, type: action, payloadSnapshot: body as Prisma.InputJsonValue },
        });
      });
    } else if (eventType === "subscription_authorized_payment") {
      const invoice = await getInvoiceFromMercadoPago(dataId);

      await prisma.$transaction(async (tx) => {
        const clinic = await tx.clinic.findUnique({
          where: { mercadoPagoSubscriptionId: invoice.subscriptionId },
        });
        if (!clinic) throw new Error("Fatura sem clínica vinculada.");

        await tx.paymentHistory.upsert({
          where: { mercadoPagoPaymentId: invoice.paymentId },
          create: {
            clinicId: clinic.id,
            amount: invoice.amount,
            status: invoice.status,
            plan: clinic.subscriptionPlan,
            mercadoPagoPaymentId: invoice.paymentId,
            mercadoPagoSubscriptionId: invoice.subscriptionId,
            paidAt: invoice.paidAt,
          },
          update: { amount: invoice.amount, status: invoice.status, paidAt: invoice.paidAt },
        });

        if (invoice.status === "approved") {
          await tx.clinic.update({
            where: { id: clinic.id },
            data: { subscriptionStatus: "ACTIVE", hasPaidOnce: true },
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
