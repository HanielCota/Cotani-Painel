import prisma from "@/lib/prisma";

export interface RateLimitConfig {
  /** Identificador único do limitador (ex: IP + rota). */
  key: string;
  /** Número máximo de requisições permitidas na janela. */
  limit: number;
  /** Duração da janela em milissegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

function getWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Rate limiter baseado no banco de dados.
 *
 * Usa uma janela fixa (fixed window) por `key`. É suficiente para o MVP e
 * funciona em ambientes serverless sem depender de infraestrutura extra.
 */
export async function rateLimit(config: RateLimitConfig, now = new Date()): Promise<RateLimitResult> {
  const windowStart = getWindowStart(now, config.windowMs);
  const resetAt = new Date(windowStart.getTime() + config.windowMs);

  const record = await prisma.rateLimit.upsert({
    where: {
      key_windowStart: {
        key: config.key,
        windowStart,
      },
    },
    create: {
      key: config.key,
      windowStart,
      resetAt,
      count: 1,
    },
    update: {
      count: {
        increment: 1,
      },
    },
  });

  return {
    success: record.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - record.count),
    resetAt,
  };
}
