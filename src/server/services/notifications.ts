import type { Prisma } from "@/generated/prisma/client";
import type { NotificationKind } from "@/generated/prisma/enums";

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

function buildContent(kind: NotificationKind, params: AppointmentNotificationParams) {
  const when = formatClinicDateTime(params.startTime, params.timeZone);

  switch (kind) {
    case "CONFIRMATION":
      return `Olá ${params.customerName}! Seu atendimento de ${params.serviceName} na ${params.clinicName} está agendado para ${when}. Precisa cancelar? Acesse: ${buildCancellationUrl(params)}`;
    case "REMINDER_24H":
      return `Olá ${params.customerName}! Lembrete: amanhã às ${when.slice(-5)} você tem ${params.serviceName} na ${params.clinicName}.`;
    case "REMINDER_2H":
      return `Olá ${params.customerName}! Lembrete: em 2 horas, às ${when.slice(-5)}, você tem ${params.serviceName} na ${params.clinicName}.`;
  }
}

function buildCancellationUrl(params: AppointmentNotificationParams): string {
  // URL absoluta mínima: o domínio real deve vir de uma variável de ambiente
  // quando disponível; fallback para path relativo funciona em links clicáveis.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${baseUrl}/${params.clinicSlug}/cancelar/${params.cancellationToken}`;
}

function buildReminderInputs(params: AppointmentNotificationParams, now: Date) {
  return REMINDER_OFFSETS.map(({ kind, offsetMs }) => ({ kind, scheduledFor: new Date(params.startTime.getTime() - offsetMs) }))
    .filter(({ scheduledFor }) => scheduledFor > now)
    .map(({ kind, scheduledFor }) => ({
      kind,
      channel: "WHATSAPP" as const,
      status: "PENDING" as const,
      recipient: params.customerPhone,
      content: buildContent(kind, params),
      idempotencyKey: `${params.appointmentId}:${kind}`,
      scheduledFor,
      nextAttemptAt: scheduledFor,
      clinicId: params.clinicId,
      appointmentId: params.appointmentId,
    }));
}

/** Enfileira confirmação imediata + lembretes futuros ao criar um atendimento. */
export async function enqueueAppointmentNotifications(
  transaction: Prisma.TransactionClient,
  params: AppointmentNotificationParams,
) {
  const now = new Date();

  await transaction.notification.createMany({
    data: [
      {
        kind: "CONFIRMATION" as const,
        channel: "WHATSAPP" as const,
        status: "PENDING" as const,
        recipient: params.customerPhone,
        content: buildContent("CONFIRMATION", params),
        idempotencyKey: `${params.appointmentId}:CONFIRMATION`,
        scheduledFor: now,
        nextAttemptAt: now,
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
      },
      ...buildReminderInputs(params, now),
    ],
  });
}

/**
 * Remove as notificações PENDENTES do atendimento. Usamos delete em vez de
 * marcar como CANCELED para liberar a `idempotencyKey` (única) — assim um
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

/** Substitui os lembretes ao reagendar: remove os pendentes e cria novos para o novo horário. */
export async function replaceAppointmentReminders(
  transaction: Prisma.TransactionClient,
  params: AppointmentNotificationParams,
) {
  await deletePendingNotifications(transaction, params.appointmentId);

  const reminders = buildReminderInputs(params, new Date());

  if (reminders.length > 0) {
    await transaction.notification.createMany({ data: reminders });
  }
}
