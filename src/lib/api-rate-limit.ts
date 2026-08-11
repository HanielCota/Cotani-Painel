import { NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/get-client-ip";
import { rateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Aplica rate limit por IP em uma rota de API privada.
 *
 * Retorna `null` se a requisição deve continuar, ou uma resposta 429 se o
 * limite foi excedido. Deve ser chamada no início do handler, após a
 * autenticação.
 */
export async function checkApiRateLimit(
  request: NextRequest,
  keySuffix: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const result = await rateLimit({
    key: `api:${keySuffix}:${ip}`,
    limit,
    windowMs,
  });

  if (!result.success) {
    return NextResponse.json(
      { message: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 },
    );
  }

  return null;
}
