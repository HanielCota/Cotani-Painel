const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const wholeBrlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatCurrency(value: number): string {
  return brlFormatter.format(value);
}

export function formatWholeCurrency(value: number): string {
  return wholeBrlFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDateTime(value: Date | string, timeZone?: string): string {
  const key = timeZone ?? "local";
  let formatter = dateTimeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    });
    dateTimeFormatters.set(key, formatter);
  }
  return formatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: Date | string, timeZone?: string): string {
  const key = timeZone ?? "local";
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    });
    dateFormatters.set(key, formatter);
  }
  return formatter.format(typeof value === "string" ? new Date(value) : value);
}
