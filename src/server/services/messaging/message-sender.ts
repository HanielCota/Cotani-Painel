import "server-only";

import type { NotificationChannel, NotificationKind } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { readJsonOrNull } from "@/lib/ignore-failure";

/**
 * Mensagem de saída normalizada, independente de canal ou provedor.
 * O único chamador previsto é o dispatcher da fila (docs/ARCHITECTURE.md, seção 5).
 */
export interface OutboundMessage {
  channel: NotificationChannel;
  /** Telefone em E.164 ou endereço de e-mail, resolvido no momento do enfileiramento. */
  recipient: string;
  content: string;
  /** Presente para mensagens proativas da fila; permite usar template aprovado no WhatsApp. */
  notificationKind?: NotificationKind;
  /** Chave única por mensagem lógica - o provedor e a fila deduplicam por ela. */
  idempotencyKey: string;
}

export interface SendResult {
  ok: boolean;
  /** Identificador retornado pelo provedor, persistido em Notification.providerRef. */
  providerRef?: string;
  error?: string;
}

export interface MessageSender {
  send(message: OutboundMessage): Promise<SendResult>;
}

/**
 * Mock de MVP: registra o envio no log (sem destinatário nem texto) e simula sucesso.
 * Substituições planejadas: Evolution API (menor atrito inicial) e,
 * como caminho definitivo de compliance, a Meta Cloud API.
 */
export class ConsoleMessageSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    logger.info("Envio simulado pelo message-sender de teste", {
      channel: message.channel,
      contentLength: message.content.length,
      idempotencyKey: message.idempotencyKey,
    });

    return { ok: true, providerRef: `mock:${message.idempotencyKey}` };
  }
}

class ResendEmailSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!apiKey || !from) return { ok: false, error: "Credenciais de e-mail não configuradas." };

    const subjects: Partial<Record<NotificationKind, string>> = {
      CONFIRMATION: "Agendamento recebido · Cotani",
      REMINDER_24H: "Seu atendimento é amanhã · Cotani",
      REMINDER_2H: "Seu atendimento começa em 2 horas · Cotani",
    };
    const subject = message.notificationKind
      ? (subjects[message.notificationKind] ?? "Atualização do seu agendamento · Cotani")
      : "Atualização do seu agendamento · Cotani";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [message.recipient], subject, text: message.content }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await readJsonOrNull<{ id?: string; message?: string }>(response);
    return response.ok
      ? { ok: true, providerRef: payload?.id }
      : { ok: false, error: payload?.message ?? `Resend HTTP ${response.status}` };
  }
}

class TwilioSmsSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_SMS_FROM?.trim();
    const recipient = normalizeWhatsAppPhone(message.recipient);
    if (!accountSid || !authToken || !from) return { ok: false, error: "Credenciais de SMS não configuradas." };
    if (!recipient) return { ok: false, error: "Telefone inválido para SMS." };

    const body = new URLSearchParams({ To: `+${recipient}`, From: from, Body: message.content });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = await readJsonOrNull<{ sid?: string; message?: string }>(response);
    return response.ok
      ? { ok: true, providerRef: payload?.sid }
      : { ok: false, error: payload?.message ?? `Twilio HTTP ${response.status}` };
  }
}

class MetaWhatsAppSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
    const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
    const templateName = process.env.META_WHATSAPP_APPOINTMENT_TEMPLATE?.trim();
    const templateLanguage = process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "pt_BR";
    const recipient = normalizeWhatsAppPhone(message.recipient);

    if (!accessToken || !phoneNumberId) {
      return { ok: false, error: "Credenciais da Meta WhatsApp Cloud API não configuradas." };
    }

    if (!recipient) {
      return { ok: false, error: "Telefone inválido para WhatsApp." };
    }

    if (message.notificationKind && message.notificationKind !== "RESCHEDULE_RESPONSE" && !templateName) {
      return { ok: false, error: "Template de agendamento do WhatsApp não configurado." };
    }

    const requiresTemplate = message.notificationKind && message.notificationKind !== "RESCHEDULE_RESPONSE";
    const messagePayload = requiresTemplate
      ? {
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: message.content }],
              },
            ],
          },
        }
      : {
          type: "text",
          text: { preview_url: false, body: message.content },
        };

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          ...messagePayload,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = await readJsonOrNull<{ messages?: Array<{ id?: string }>; error?: { message?: string } }>(response);

    if (!response.ok) {
      return { ok: false, error: payload?.error?.message ?? `Meta API HTTP ${response.status}` };
    }

    return { ok: true, providerRef: payload?.messages?.[0]?.id };
  }
}

/**
 * Ponto único de troca de provedor por canal. No MVP todos os canais
 * resolvem para o mock; senders reais entram aqui sem tocar no dispatcher.
 */
const senders: Record<NotificationChannel, MessageSender> = {
  WHATSAPP: new MetaWhatsAppSender(),
  EMAIL: new ResendEmailSender(),
  SMS: new TwilioSmsSender(),
};

export function getMessageSender(channel: NotificationChannel): MessageSender {
  if (channel === "WHATSAPP" && process.env.WHATSAPP_SENDER_MODE !== "api") {
    return new ConsoleMessageSender();
  }
  return senders[channel];
}
