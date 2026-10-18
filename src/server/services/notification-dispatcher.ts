import "server-only";

import prisma from "@/lib/prisma";
import type { NotificationModel } from "@/generated/prisma/models/Notification";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { getMessageSender } from "@/server/services/messaging/message-sender";
import { isWhatsAppApiMode } from "@/server/services/messaging/sender-mode";
import { isSubscriptionActive } from "@/server/subscription";

/**
 * Dispatcher da fila de notificações (outbox `Notification`).
 *
 * WhatsApp no modo "manual" é pulado: o profissional envia as mensagens pelo
 * próprio WhatsApp via link wa.me no CRM de comunicações.
 */

const BATCH_SIZE = 25;
const LOCK_TIMEOUT_MS = 5 * 60_000;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240] as const;
const MAX_ERROR_LENGTH = 500;

export interface DispatchStats {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

/**
 * Claim atômico de um lote: a transação mantém o lock das linhas selecionadas
 * (FOR UPDATE SKIP LOCKED) até o commit, então execuções concorrentes do cron
 * pulam as linhas já reservadas. Após o commit, `lockedAt` impede que outra
 * execução reivindique as mesmas linhas antes do timeout de recuperação.
 */
async function claimBatch(now: Date, skipWhatsApp: boolean) {
  const staleLockBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Notification"
      WHERE "status" = 'PENDING'
        AND "nextAttemptAt" <= ${now}
        AND (${skipWhatsApp} = FALSE OR "channel" <> 'WHATSAPP')
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

/** Lembretes vencidos ou de atendimentos encerrados não devem mais sair. */
async function cancelExpiredReminders(now: Date) {
  await prisma.notification.updateMany({
    where: { status: "PENDING", kind: { in: ["REMINDER_24H", "REMINDER_2H"] }, appointment: { OR: [{ startTime: { lte: now } }, { status: { in: ["CANCELED", "NO_SHOW", "COMPLETED"] } }] } },
    data: { status: "CANCELED", lockedAt: null, error: "Lembrete expirado ou atendimento encerrado." },
  });
}

/** A loja ainda pode enviar por este canal (ativa, assinatura em dia, plano)? */
async function canClinicSend(notification: NotificationModel) {
  const clinic = await prisma.clinic.findUnique({ where: { id: notification.clinicId }, include: { billingOwner: true } });
  return Boolean(clinic && !clinic.deletedAt && clinic.operationalStatus === "ACTIVE" && isSubscriptionActive(clinic)
    && (notification.channel !== "SMS" || getPlanEntitlements(clinic.subscriptionPlan).sms));
}

async function sendOne(notification: NotificationModel, stats: DispatchStats) {
  if (!(await canClinicSend(notification))) {
    await prisma.notification.update({ where: { id: notification.id }, data: {
      status: "CANCELED", lockedAt: null, error: "Envio não permitido pelo plano ou situação atual do negócio.",
    } });
    return;
  }

  const result = await getMessageSender(notification.channel).send({
    channel: notification.channel,
    recipient: notification.recipient,
    content: notification.content,
    notificationKind: notification.kind,
    idempotencyKey: notification.idempotencyKey,
  });

  if (!result.ok) {
    await registerFailure(notification, result.error ?? "Falha desconhecida no envio.", stats);
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: "SENT", sentAt: new Date(), providerRef: result.providerRef, lockedAt: null, error: null },
  });
  stats.sent += 1;
}

/** Processa um lote da fila: cancela lembretes vencidos e envia o que é devido. */
export async function dispatchDueNotifications(now = new Date()): Promise<DispatchStats> {
  await cancelExpiredReminders(now);
  const batch = await claimBatch(now, !isWhatsAppApiMode());
  const stats: DispatchStats = { claimed: batch.length, sent: 0, retried: 0, failed: 0 };

  // Envio sequencial intencional: lote pequeno, respeita rate limits dos provedores
  // e mantém a duração da função bem abaixo do limite da Vercel.
  for (const notification of batch) {
    try {
      await sendOne(notification, stats);
    } catch (error) {
      await registerFailure(notification, error instanceof Error ? error.message : "Erro inesperado no envio.", stats);
    }
  }

  return stats;
}
