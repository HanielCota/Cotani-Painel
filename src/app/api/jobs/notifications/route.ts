import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import type { NotificationModel } from "@/generated/prisma/models/Notification";
import { getMessageSender } from "@/server/services/messaging/message-sender";

/**
 * Dispatcher da fila de notificações (docs/ARCHITECTURE.md, seção 5.3).
 * Acionado pelo Vercel Cron (vercel.json). O Cron envia GET com o header
 * `Authorization: Bearer ${CRON_SECRET}`; POST é aceito para disparo manual.
 */

const cronSecretSchema = z.string().min(1);

const BATCH_SIZE = 25;
const LOCK_TIMEOUT_MS = 5 * 60_000;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240] as const;
const MAX_ERROR_LENGTH = 500;

/**
 * Claim atômico de um lote: a transação mantém o lock das linhas selecionadas
 * (FOR UPDATE SKIP LOCKED) até o commit, então execuções concorrentes do cron
 * pulam as linhas já reservadas. Após o commit, `lockedAt` impede que outra
 * execução reivindique as mesmas linhas antes do timeout de recuperação.
 */
async function claimBatch(now: Date) {
  const staleLockBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Notification"
      WHERE "status" = 'PENDING'
        AND "nextAttemptAt" <= ${now}
        AND ("lockedAt" IS NULL OR "lockedAt" < ${staleLockBefore})
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;

    if (claimed.length === 0) {
      return [];
    }

    const ids = claimed.map((row) => row.id);

    await transaction.notification.updateMany({
      where: { id: { in: ids } },
      data: { lockedAt: now },
    });

    return transaction.notification.findMany({
      where: { id: { in: ids } },
      orderBy: { nextAttemptAt: "asc" },
    });
  });
}

interface DispatchStats {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

async function registerFailure(notification: NotificationModel, errorMessage: string, stats: DispatchStats) {
  const attempts = notification.attempts + 1;
  const error = errorMessage.slice(0, MAX_ERROR_LENGTH);

  if (attempts >= notification.maxAttempts) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", attempts, error, lockedAt: null },
    });
    stats.failed += 1;
    return;
  }

  const backoffMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      attempts,
      error,
      lockedAt: null,
      nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
    },
  });
  stats.retried += 1;
}

async function dispatch(request: NextRequest) {
  const parsedSecret = cronSecretSchema.safeParse(process.env.CRON_SECRET);

  if (!parsedSecret.success) {
    return NextResponse.json({ message: "CRON_SECRET não está configurado." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${parsedSecret.data}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const batch = await claimBatch(new Date());
  const stats: DispatchStats = { claimed: batch.length, sent: 0, retried: 0, failed: 0 };

  // Envio sequencial intencional: lote pequeno, respeita rate limits dos provedores
  // e mantém a duração da função bem abaixo do limite da Vercel.
  for (const notification of batch) {
    const sender = getMessageSender(notification.channel);

    try {
      const result = await sender.send({
        channel: notification.channel,
        recipient: notification.recipient,
        content: notification.content,
        idempotencyKey: notification.idempotencyKey,
      });

      if (result.ok) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            providerRef: result.providerRef,
            lockedAt: null,
            error: null,
          },
        });
        stats.sent += 1;
      } else {
        await registerFailure(notification, result.error ?? "Falha desconhecida no envio.", stats);
      }
    } catch (error) {
      await registerFailure(
        notification,
        error instanceof Error ? error.message : "Erro inesperado no envio.",
        stats,
      );
    }
  }

  return NextResponse.json(stats);
}

export async function GET(request: NextRequest) {
  return dispatch(request);
}

export async function POST(request: NextRequest) {
  return dispatch(request);
}
