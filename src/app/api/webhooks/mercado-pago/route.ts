import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  syncSubscriptionFromMercadoPago,
  validateMercadoPagoWebhook,
} from "@/server/services/mercado-pago";

function getQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dataId = getQueryParam(searchParams.get("data.id") ?? undefined);
  const eventType = getQueryParam(searchParams.get("type") ?? undefined);

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!dataId || !eventType) {
    return NextResponse.json({ message: "Parâmetros data.id e type são obrigatórios." }, { status: 400 });
  }

  try {
    validateMercadoPagoWebhook({ xSignature, xRequestId, dataId });
  } catch (error) {
    console.error("[mercado-pago-webhook] Assinatura do webhook inválida", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 401 });
  }

  const eventId = `${eventType}-${dataId}`;

  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: "mercado-pago",
        eventId,
      },
    },
  });

  if (existingEvent) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    if (eventType === "subscription_preapproval") {
      const synced = await syncSubscriptionFromMercadoPago({ mercadoPagoSubscriptionId: dataId });

      const clinic = await prisma.clinic.findUnique({
        where: { mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId },
      });

      if (clinic) {
        await prisma.clinic.update({
          where: { id: clinic.id },
          data: {
            subscriptionStatus: synced.status,
            hasPaidOnce: synced.hasPaidOnce || clinic.hasPaidOnce,
            subscriptionExpiresAt: synced.nextPaymentDate,
          },
        });

        if (synced.status === "ACTIVE") {
          const existingPayment = await prisma.paymentHistory.findFirst({
            where: {
              clinicId: clinic.id,
              mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId,
              status: "paid",
            },
          });

          if (!existingPayment) {
            await prisma.paymentHistory.create({
              data: {
                clinicId: clinic.id,
                amount: clinic.subscriptionPlan === "ANNUAL" ? 970 : 97,
                status: "paid",
                plan: clinic.subscriptionPlan,
                mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId,
                paidAt: synced.nextPaymentDate ?? new Date(),
              },
            });
          }
        }
      } else {
        console.warn("[mercado-pago-webhook] Assinatura não vinculada a nenhuma barbearia", {
          mercadoPagoSubscriptionId: synced.mercadoPagoSubscriptionId,
        });
      }
    } else {
      console.log("[mercado-pago-webhook] Tipo de evento ignorado", { eventType, dataId });
    }

    await prisma.webhookEvent.create({
      data: {
        provider: "mercado-pago",
        eventId,
        type: eventType,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[mercado-pago-webhook] Falha ao processar evento", {
      eventId,
      eventType,
      dataId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ message: "Falha ao processar evento do webhook." }, { status: 500 });
  }
}
