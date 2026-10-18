import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DATABASE_TIMEOUT_MS = 3_000;

// Sempre executa na hora: um health check em cache esconderia a queda.
export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<"ok" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DATABASE_TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch (error) {
    logger.error("Health check: banco indisponível", { reason: error instanceof Error ? error.message : "unknown" });
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verificação de saúde para monitoramento externo (UptimeRobot, Better Stack,
 * Vercel). Pública e sem dados: responde 200 quando o app e o banco estão de
 * pé e 503 caso contrário. Detalhes do erro ficam só nos logs.
 */
async function health() {
  const database = await checkDatabase();
  const healthy = database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks: { database }, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export const GET = health;

export async function HEAD() {
  const response = await health();
  return new NextResponse(null, { status: response.status, headers: response.headers });
}
