import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { NotificationChannel, NotificationKind } from "@/generated/prisma/enums";

/**
 * Outbox transacional de notificações (docs/ARCHITECTURE.md, seção 5.3).
 * Todas as funções recebem o cliente transacional e devem ser chamadas
 * dentro do mesmo `prisma.$transaction` da operação de agenda correspondente.
 */

interface AppointmentNotificationParams {
  appointmentId: string;
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  timeZone: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  channels?: readonly NotificationChannel[];
  serviceName: string;
  startTime: Date;
  cancellationToken: string;
}

const REMINDER_OFFSETS = [
  { kind: "REMINDER_24H", offsetMs: 24 * 60 * 60_000 },
  { kind: "REMINDER_2H", offsetMs: 2 * 60 * 60_000 },
] as const satisfies readonly { kind: NotificationKind; offsetMs: number }[];

function formatClinicDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildContent(
  kind: NotificationKind,
  channel: NotificationChannel,
  params: AppointmentNotificationParams,
) {
  const when = formatClinicDateTime(params.startTime, params.timeZone);
  const acceptsAutomaticWhatsAppReply =
    channel === "WHATSAPP" && process.env.WHATSAPP_SENDER_MODE?.trim().toLowerCase() === "api";
  const replyInstructions = acceptsAutomaticWhatsAppReply
    ? " Responda 1 para confirmar ou 2 para solicitar um reagendamento."
    : "";

  switch (kind) {
    case "CONFIRMATION":
      return `Olá ${params.customerName}! Seu atendimento de ${params.serviceName} na ${params.clinicName} está agendado para ${when}.${replyInstructions} Para cancelar, acesse: ${buildCancellationUrl(params)}`;
    case "REMINDER_24H":
      return `Olá ${params.customerName}! Lembrete: amanhã às ${when.slice(-5)} você tem ${params.serviceName} na ${params.clinicName}.${replyInstructions}`;
    case "REMINDER_2H":
      return `Olá ${params.customerName}! Lembrete: em 2 horas, às ${when.slice(-5)}, você tem ${params.serviceName} na ${params.clinicName}.${replyInstructions}`;
    case "RESCHEDULE_RESPONSE":
      return `Olá ${params.customerName}! Recebemos sua solicitação de reagendamento para ${params.serviceName} na ${params.clinicName}.`;
  }
}

function buildCancellationUrl(params: AppointmentNotificationParams): string {
  // URL absoluta mínima: o domínio real deve vir de uma variável de ambiente
  // quando disponível; fallback para path relativo funciona em links clicáveis.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${baseUrl}/${params.clinicSlug}/cancelar/${params.cancellationToken}`;
}

function getRecipient(channel: NotificationChannel, params: AppointmentNotificationParams) {
  return channel === "EMAIL" ? params.customerEmail?.trim() : params.customerPhone;
}

function getChannels(params: AppointmentNotificationParams) {
  return params.channels?.length ? params.channels : ["WHATSAPP" as const];
}

function buildReminderInputs(params: AppointmentNotificationParams, now: Date) {
  return REMINDER_OFFSETS.map(({ kind, offsetMs }) => ({ kind, scheduledFor: new Date(params.startTime.getTime() - offsetMs) }))
    .filter(({ scheduledFor }) => scheduledFor > now)
    .flatMap(({ kind, scheduledFor }) => getChannels(params).map((channel) => ({ kind, channel, scheduledFor })))
    .flatMap(({ kind, channel, scheduledFor }) => {
      const recipient = getRecipient(channel, params);
      return recipient ? [{
        kind,
        channel,
        status: "PENDING" as const,
        recipient,
        content: buildContent(kind, channel, params),
        idempotencyKey: `${params.appointmentId}:${kind}:${channel}:${params.startTime.toISOString()}`,
        scheduledFor,
        nextAttemptAt: scheduledFor,
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
      }] : [];
    });
}

/** Enfileira confirmação imediata + lembretes futuros ao criar um atendimento. */
export async function enqueueAppointmentNotifications(
  transaction: Prisma.TransactionClient,
  params: AppointmentNotificationParams,
) {
  const now = new Date();
  const confirmations = getChannels(params).flatMap((channel) => {
    const recipient = getRecipient(channel, params);
    return recipient ? [{
      kind: "CONFIRMATION" as const,
      channel,
      status: "PENDING" as const,
      recipient,
      content: buildContent("CONFIRMATION", channel, params),
      idempotencyKey: `${params.appointmentId}:CONFIRMATION:${channel}:${params.startTime.toISOString()}`,
      scheduledFor: now,
      nextAttemptAt: now,
      clinicId: params.clinicId,
      appointmentId: params.appointmentId,
    }] : [];
  });

  await transaction.notification.createMany({
    data: [
      ...confirmations,
      ...buildReminderInputs(params, now),
    ],
  });
}

/**
 * Remove as notificações PENDENTES do atendimento. Usamos delete em vez de
 * marcar como CANCELED para liberar a `idempotencyKey` (única) - assim um
 * reagendamento pode reenfileirar o mesmo tipo de lembrete sem colisão.
 * Linhas com lock fresco (em processamento pelo dispatcher) são preservadas.
 */
export async function deletePendingNotifications(transaction: Prisma.TransactionClient, appointmentId: string) {
  const staleLockBefore = new Date(Date.now() - 5 * 60_000);

  await transaction.notification.deleteMany({
    where: {
      appointmentId,
      status: "PENDING",
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockBefore } }],
    },
  });
}

/** Substitui confirmação e lembretes ao reagendar, sempre com o horário atualizado. */
export async function replaceAppointmentReminders(
  transaction: Prisma.TransactionClient,
  params: AppointmentNotificationParams,
) {
  await deletePendingNotifications(transaction, params.appointmentId);

  await enqueueAppointmentNotifications(transaction, params);
}
