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

export function formatBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const hasCountryCode = digits.startsWith("55") && digits.length >= 12;
  const localDigits = hasCountryCode ? digits.slice(2) : digits;
  const countryPrefix = hasCountryCode ? "+55 " : "";

  if (localDigits.length === 11) {
    return `${countryPrefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }

  if (localDigits.length === 10) {
    return `${countryPrefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  return phone;
}

/** Máscara progressiva para campos de telefone brasileiro. */
export function formatBrazilianPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}
