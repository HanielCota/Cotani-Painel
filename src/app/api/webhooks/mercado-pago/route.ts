import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import { getInvoiceFromMercadoPago, searchSubscriptionInvoices, validateMercadoPagoWebhook } from "@/server/services/mercado-pago";
import { settleSubscription } from "@/server/services/billing-settlement";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { id?: string | number; type?: string; action?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(await readRequestText(request, 256 * 1024));
    if (!body || typeof body !== "object") throw new Error("Invalid body");
  } catch (error) {
    return NextResponse.json({ message: "Corpo inválido." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  const dataId = String(body.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? "").trim();
  const eventType = body.type ?? request.nextUrl.searchParams.get("type");
  if (!dataId || !eventType) return NextResponse.json({ message: "Evento sem identificação." }, { status: 400 });
  try {
    validateMercadoPagoWebhook({ dataId, xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id") });
  } catch {
    return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
  }
  const eventId = String(body.id ?? `${eventType}:${dataId}:${request.headers.get("x-request-id")}`);
  try {
    if (await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: "mercado-pago", eventId } } })) {
      return NextResponse.json({ received: true, skipped: true });
    }
    if (eventType === "subscription_preapproval") {
      await settleSubscription(dataId);
    } else if (eventType === "subscription_authorized_payment" || eventType === "payment") {
      const invoiceIds = eventType === "payment" ? await searchSubscriptionInvoices(undefined, dataId) : [dataId];
      for (const id of invoiceIds) {
        const invoice = await getInvoiceFromMercadoPago(id);
        await settleSubscription(invoice.subscriptionId, id);
      }
    }
    // Settlement is independently idempotent. A crash before this record safely retries.
    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: "mercado-pago", eventId } }, update: {},
      create: { provider: "mercado-pago", eventId, type: eventType, payloadSnapshot: body as Prisma.InputJsonValue },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Falha ao conciliar notificação Mercado Pago", { eventId, eventType, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ message: "Falha ao conciliar evento." }, { status: 500 });
  }
}
