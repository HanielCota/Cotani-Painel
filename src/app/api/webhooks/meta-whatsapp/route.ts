import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { logger } from "@/lib/logger";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";

interface MetaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  context?: { id?: string };
}

interface MetaWebhookPayload {
  entry?: Array<{ changes?: Array<{ value?: { messages?: MetaMessage[] } }> }>;
}

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && challenge && token === process.env.META_WHATSAPP_VERIFY_TOKEN?.trim()) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ message: "Verificação inválida." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await readRequestText(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ message: "Corpo do webhook muito grande." }, { status: 413 });
    }
    return NextResponse.json({ message: "Corpo inválido." }, { status: 400 });
  }

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ message: "Corpo inválido." }, { status: 400 });
  }

  const messages =
    payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];

  for (const message of messages) {
    const eventId = message.id?.trim();
    const phone = message.from ? normalizeWhatsAppPhone(message.from) : null;
    const answer = message.text?.body?.trim().toLocaleLowerCase("pt-BR");
    if (!eventId || !phone || !answer) continue;

    const seen = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: "meta-whatsapp", eventId } },
      select: { id: true },
    });
    if (seen) continue;

    const notificationWhere = {
      channel: "WHATSAPP" as const,
      recipient: phone,
      status: "SENT" as const,
      appointment: {
        status: "PENDING" as const,
        startTime: { gte: new Date() },
        clinic: { deletedAt: null, operationalStatus: "ACTIVE" as const },
      },
    };
    const includeAppointment = {
      appointment: { include: { clinic: { select: { id: true, name: true, slug: true } } } },
    } as const;
    const replyToProviderRef = message.context?.id?.trim();
    const exactOutbound = replyToProviderRef
      ? await prisma.notification.findFirst({
          where: { ...notificationWhere, providerRef: replyToProviderRef },
          include: includeAppointment,
        })
      : null;
    const recentOutbounds = exactOutbound
      ? [exactOutbound]
      : await prisma.notification.findMany({
          where: { ...notificationWhere, sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) } },
          include: includeAppointment,
          orderBy: { sentAt: "desc" },
          take: 10,
        });
    const appointmentIds = new Set(recentOutbounds.map((notification) => notification.appointmentId));
    const appointment = appointmentIds.size === 1 ? (recentOutbounds[0]?.appointment ?? null) : null;
    const ambiguous = !exactOutbound && appointmentIds.size > 1;

    try {
      await prisma.$transaction(async (transaction) => {
        if (appointment && ["1", "confirmar", "confirmado", "sim"].includes(answer)) {
          await transaction.appointment.updateMany({
            where: { id: appointment.id, status: "PENDING" },
            data: { status: "CONFIRMED" },
          });
        }
        if (appointment && ["2", "reagendar", "remarcar"].includes(answer)) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
          const now = new Date();
          await transaction.notification.create({
            data: {
              kind: "RESCHEDULE_RESPONSE",
              channel: "WHATSAPP",
              recipient: phone,
              content: `Para reagendar na ${appointment.clinic.name}, escolha um novo horário em ${baseUrl}/${appointment.clinic.slug}/reagendar/${appointment.cancellationToken}. O horário atual só será liberado após a confirmação.`,
              idempotencyKey: `${eventId}:reschedule-response`,
              scheduledFor: now,
              nextAttemptAt: now,
              clinicId: appointment.clinic.id,
              appointmentId: appointment.id,
            },
          });
        }
        await transaction.webhookEvent.create({
          data: {
            provider: "meta-whatsapp",
            eventId,
            type: ambiguous ? "message.received.ambiguous" : "message.received",
            payloadSnapshot: message as unknown as Prisma.InputJsonValue,
          },
        });
      });
      if (ambiguous)
        logger.warn("Resposta do WhatsApp ignorada por associação ambígua", {
          eventId,
          candidateAppointments: appointmentIds.size,
        });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") continue;
      throw error;
    }
  }

  logger.info("Webhook da Meta processado", { messages: messages.length });
  return NextResponse.json({ received: true });
}
