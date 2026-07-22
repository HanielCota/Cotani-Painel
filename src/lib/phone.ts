/**
 * Normaliza um número de telefone brasileiro para o formato usado em links wa.me.
 * Remove tudo que não for dígito e garante o prefixo internacional 55.
 *
 * Regras:
 * - Se já começar com 55 e tiver 12 ou 13 dígitos, mantém.
 * - Se tiver 10 ou 11 dígitos (com DDD), adiciona 55.
 * - Caso contrário, retorna null (número inválido para WhatsApp).
 */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 13 || digits.length === 12) {
    return digits.startsWith("55") ? digits : null;
  }

  if (digits.length === 11 || digits.length === 10) {
    return `55${digits}`;
  }

  return null;
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}
