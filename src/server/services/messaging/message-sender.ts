import type { NotificationChannel } from "@/generated/prisma/enums";
import { normalizeWhatsAppPhone } from "@/lib/phone";

/**
 * Mensagem de saída normalizada, independente de canal ou provedor.
 * O único chamador previsto é o dispatcher da fila (docs/ARCHITECTURE.md, seção 5).
 */
export interface OutboundMessage {
  channel: NotificationChannel;
  /** Telefone em E.164 ou endereço de e-mail, resolvido no momento do enfileiramento. */
  recipient: string;
  content: string;
  /** Chave única por mensagem lógica — o provedor e a fila deduplicam por ela. */
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
 * Mock de MVP: registra a mensagem no console e simula sucesso.
 * Substituições planejadas: Evolution API (menor atrito inicial) e,
 * como caminho definitivo de compliance, a Meta Cloud API.
 */
export class ConsoleMessageSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    console.info("[message-sender:mock] envio simulado", {
      channel: message.channel,
      recipient: message.recipient,
      content: message.content,
      idempotencyKey: message.idempotencyKey,
    });

    return { ok: true, providerRef: `mock:${message.idempotencyKey}` };
  }
}

class MetaWhatsAppSender implements MessageSender {
  async send(message: OutboundMessage): Promise<SendResult> {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
    const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
    const recipient = normalizeWhatsAppPhone(message.recipient);

    if (!accessToken || !phoneNumberId) {
      return { ok: false, error: "Credenciais da Meta WhatsApp Cloud API não configuradas." };
    }

    if (!recipient) {
      return { ok: false, error: "Telefone inválido para WhatsApp." };
    }

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
          type: "text",
          text: { preview_url: false, body: message.content },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

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
  EMAIL: new ConsoleMessageSender(),
  SMS: new ConsoleMessageSender(),
};

export function getMessageSender(channel: NotificationChannel): MessageSender {
  return senders[channel];
}
