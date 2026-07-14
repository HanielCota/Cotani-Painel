import type { NotificationChannel } from "@/generated/prisma/enums";

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

/**
 * Ponto único de troca de provedor por canal. No MVP todos os canais
 * resolvem para o mock; senders reais entram aqui sem tocar no dispatcher.
 */
const senders: Record<NotificationChannel, MessageSender> = {
  WHATSAPP: new ConsoleMessageSender(),
  EMAIL: new ConsoleMessageSender(),
  SMS: new ConsoleMessageSender(),
};

export function getMessageSender(channel: NotificationChannel): MessageSender {
  return senders[channel];
}
