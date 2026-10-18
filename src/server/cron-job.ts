import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { matchesBearerSecret } from "@/lib/secure-compare";
import { getHttpOperationOutcome, monitorOperation, type OperationOutcome } from "@/server/services/operational-monitoring";

const cronSecretSchema = z.string().min(1);

/**
 * Autoriza chamadas de cron: `Authorization: Bearer ${CRON_SECRET}`.
 * Devolve a resposta de erro, ou `null` quando a chamada é legítima.
 */
export function rejectUnauthorizedCron(request: NextRequest): NextResponse | null {
  const secret = cronSecretSchema.safeParse(process.env.CRON_SECRET);
  if (!secret.success) return NextResponse.json({ message: "CRON_SECRET não está configurado." }, { status: 500 });
  if (!matchesBearerSecret(request.headers.get("authorization"), secret.data)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  return null;
}

interface CronJobOptions {
  /** Nome exibido no monitoramento operacional (/admin). */
  operation: string;
  /** A tarefa em si; só roda depois da autenticação. */
  run: () => Promise<Response>;
  outcome?: (response: Response) => OperationOutcome | null | Promise<OperationOutcome | null>;
}

/**
 * Monta os handlers GET (Vercel Cron) e POST (disparo manual) de uma tarefa
 * agendada: autenticação, execução e registro no monitoramento operacional.
 */
export function cronJob({ operation, run, outcome = getHttpOperationOutcome }: CronJobOptions) {
  const handler = (request: NextRequest) => monitorOperation(
    { category: "JOB", operation },
    async () => rejectUnauthorizedCron(request) ?? run(),
    outcome,
  );
  return { GET: handler, POST: handler };
}
