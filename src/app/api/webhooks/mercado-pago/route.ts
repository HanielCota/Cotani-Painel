import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import {
  getInvoiceFromMercadoPago,
  searchSubscriptionInvoices,
  validateMercadoPagoWebhook,
} from "@/server/services/mercado-pago";
import { settleSubscription } from "@/server/services/billing-settlement";
import { monitorOperation } from "@/server/services/operational-monitoring";

export const maxDuration = 60;

const notificationIdSchema = z.union([z.string(), z.number()]).nullish();

const notificationSchema = z.object({
  id: notificationIdSchema,
  type: z.string().nullish(),
  action: z.string().nullish(),
  data: z.object({ id: notificationIdSchema }).nullish(),
});

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(await readRequestText(request, 256 * 1024));
  } catch (error) {
    return NextResponse.json(
      { message: "Corpo inválido." },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    );
  }
  const parsedBody = notificationSchema.safeParse(rawBody);
  if (!parsedBody.success) return NextResponse.json({ message: "Corpo inválido." }, { status: 400 });
  const body = parsedBody.data;
  const dataId = String(body.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? "").trim();
  const eventType = body.type ?? request.nextUrl.searchParams.get("type");
  if (!dataId || !eventType) return NextResponse.json({ message: "Evento sem identificação." }, { status: 400 });
  try {
    validateMercadoPagoWebhook({
      dataId,
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
    });
  } catch {
    return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
  }
  const eventId = String(body.id ?? `${eventType}:${dataId}:${request.headers.get("x-request-id")}`);
  try {
    return await monitorOperation(
      { category: "WEBHOOK", operation: "mercado-pago" },
      async () => {
        if (
          await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: "mercado-pago", eventId } } })
        ) {
          return NextResponse.json({ received: true, skipped: true });
        }
        if (eventType === "subscription_preapproval") {
          await settleSubscription(dataId);
        }

        if (eventType === "subscription_authorized_payment" || eventType === "payment") {
          const invoiceIds = eventType === "payment" ? await searchSubscriptionInvoices(undefined, dataId) : [dataId];
          for (const id of invoiceIds) {
            const invoice = await getInvoiceFromMercadoPago(id);
            await settleSubscription(invoice.subscriptionId, id);
          }
        }
        // Settlement is independently idempotent. A crash before this record safely retries.
        await prisma.webhookEvent.upsert({
          where: { provider_eventId: { provider: "mercado-pago", eventId } },
          update: {},
          create: {
            provider: "mercado-pago",
            eventId,
            type: eventType,
            payloadSnapshot: body as Prisma.InputJsonValue,
          },
        });
        return NextResponse.json({ received: true });
      },
      (response) => ({
        status: response.status >= 500 ? "FAILURE" : "SUCCESS",
        summary: { eventType, httpStatus: response.status },
        externalEventId: eventId.slice(0, 160),
        ...(response.status >= 500 ? { error: `O webhook retornou HTTP ${response.status}.` } : {}),
      }),
    );
  } catch (error) {
    logger.error("Falha ao conciliar notificação Mercado Pago", {
      eventId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ message: "Falha ao conciliar evento." }, { status: 500 });
  }
}
