import "server-only";

import type { OperationalCategory, OperationalStatus, Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface OperationOutcome {
  status: OperationalStatus;
  summary?: Prisma.InputJsonValue;
  error?: string;
  externalEventId?: string;
}

interface MonitoredOperation {
  category: OperationalCategory;
  operation: string;
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada.";
  return message
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(access[_-]?token|secret|authorization)(\s*[=:]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .slice(0, 500);
}

export function getHttpOperationOutcome(response: Response): OperationOutcome | null {
  if (response.status === 401) return null;
  const status = response.status >= 500 ? "FAILURE" : response.status >= 400 ? "WARNING" : "SUCCESS";
  return {
    status,
    summary: { httpStatus: response.status },
    ...(response.status >= 500 ? { error: `A tarefa retornou HTTP ${response.status}.` } : {}),
  };
}

async function saveEvent(input: MonitoredOperation & OperationOutcome, startedAt: Date) {
  const finishedAt = new Date();
  try {
    await prisma.operationalEvent.create({
      data: {
        ...input,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      },
    });
  } catch (error) {
    logger.warn("Falha ao salvar evento do monitoramento operacional", {
      category: input.category,
      operation: input.operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Monitora uma execução sem deixar uma falha de telemetria interromper o serviço. */
export async function monitorOperation<T>(
  input: MonitoredOperation,
  run: () => Promise<T>,
  getOutcome?: (result: T) => OperationOutcome | null | Promise<OperationOutcome | null>,
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await run();
    const outcome = getOutcome ? await getOutcome(result) : { status: "SUCCESS" as const };
    if (outcome) await saveEvent({ ...input, ...outcome }, startedAt);
    return result;
  } catch (error) {
    await saveEvent({
      ...input,
      status: "FAILURE",
      error: safeErrorMessage(error),
    }, startedAt);
    throw error;
  }
}
