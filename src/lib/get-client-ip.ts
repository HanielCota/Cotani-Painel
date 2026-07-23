import type { NextRequest } from "next/server";

/**
 * Extrai o endereço IP do cliente a partir do cabeçalho `x-forwarded-for`
 * ou da propriedade `ip` do NextRequest.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return "unknown";
}
