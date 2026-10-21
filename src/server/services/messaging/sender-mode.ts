import "server-only";

/**
 * WhatsApp automático só com WHATSAPP_SENDER_MODE=api. O valor é normalizado
 * (espaços e maiúsculas) para que todos os pontos do sistema leiam igual.
 */
export function isWhatsAppApiMode(): boolean {
  return process.env.WHATSAPP_SENDER_MODE?.trim().toLowerCase() === "api";
}
