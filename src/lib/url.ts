import { headers } from "next/headers";

import { readConfiguredAppUrl } from "@/config/app-url";

/**
 * Origem pública do painel (sem barra no fim). Usa NEXT_PUBLIC_APP_URL e, na
 * falta dela (desenvolvimento), os cabeçalhos da requisição atual.
 */
export async function getAppOrigin(): Promise<string> {
  const appUrl = readConfiguredAppUrl();
  if (appUrl) return appUrl;

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const protocol = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function getPublicBookingUrl(slug: string): Promise<string> {
  return `${await getAppOrigin()}/${slug}`;
}
