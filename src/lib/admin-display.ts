export function maskNotificationRecipient(recipient: string): string {
  const normalized = recipient.trim();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex > 0 && atIndex < normalized.length - 1) {
    const name = normalized.slice(0, atIndex);
    return `${name.slice(0, 1)}•••${normalized.slice(atIndex)}`;
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 4) return `••••${digits.slice(-4)}`;
  return normalized ? "••••" : "-";
}
