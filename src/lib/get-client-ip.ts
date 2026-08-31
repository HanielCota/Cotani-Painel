import type { NextRequest } from "next/server";

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Extrai o IP normalizado dos cabeçalhos inseridos pela plataforma.
 * Na Vercel, `x-vercel-forwarded-for` e `x-forwarded-for` são sobrescritos
 * na borda, impedindo que o cliente escolha livremente este valor.
 */
export function getClientIpFromHeaders(headers: HeaderReader): string {
  const forwardedFor = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const firstAddress = forwardedFor?.split(",")[0]?.trim();

  return firstAddress || "unknown";
}

/**
 * Extrai o endereço IP do cliente a partir do cabeçalho `x-forwarded-for`
 * ou da propriedade `ip` do NextRequest.
 */
export function getClientIp(request: NextRequest): string {
  return getClientIpFromHeaders(request.headers);
}
