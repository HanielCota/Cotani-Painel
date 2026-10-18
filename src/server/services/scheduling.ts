import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { NotificationChannel } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput, getClinicDateBounds } from "@/lib/timezone";
import { isWithinStaffBookingHorizon } from "@/config/booking";
import { getClinicWeekday, minutesFromTime, resolveWorkingWindow, slotFitsWindow } from "@/server/domain/working-hours";
import { enqueueAppointmentNotifications, replaceAppointmentReminders } from "@/server/services/notifications";

export const DOUBLE_BOOKING_MESSAGE = "Horário indisponível. Por favor, escolha outro.";

/**
 * Detecta violação das exclusion constraints de agendamento
 * ("Appointment_customer_no_overlap" / "Appointment_service_no_overlap", SQLSTATE 23P01).
 * Com o driver adapter do Prisma 7, o erro chega como DriverAdapterError envolvendo
 * o erro original do pg na cadeia de `cause` - por isso a varredura é estrutural.
 */
export function isDoubleBookingError(error: unknown): boolean {
  let current: unknown = error;

  while (current !== null && typeof current === "object") {
    if ((current as { code?: unknown }).code === "23P01") {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export interface ScheduleAppointmentParams {
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  timeZone: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notificationChannels?: readonly NotificationChannel[];
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  startTime: Date;
  notes?: string;
  professionalId?: string | null;
  maxAppointmentsPerDay?: number | null;
}

export type ScheduleAppointmentResult =
  | { status: "success"; appointmentId: string; cancellationToken: string }
  | { status: "conflict" }
  | { status: "error" };

/**
 * Serializa alterações da agenda da mesma loja/dia. A trava evita que
 * duas transações ultrapassem juntas o limite diário ou passem pelo mesmo
 * check de disponibilidade antes de gravar.
 */
async function lockClinicDay(transaction: Prisma.TransactionClient, clinicId: string, day: string) {
  // A função de lock retorna o pseudo-tipo PostgreSQL `void`, que o adapter-pg
  // não desserializa. A comparação preserva o lock e devolve um booleano suportado.
  await transaction.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_advisory_xact_lock(hashtext(${`${clinicId}:${day}`})) IS NULL AS locked
  `;
}

/**
 * Confere, dentro da transação, que serviço e profissional continuam ativos e
 * segura as linhas com `FOR SHARE` até o commit. A desativação usa
 * `FOR UPDATE` nas mesmas linhas: ou ela espera este agendamento terminar (e
 * o vê ao contar os futuros), ou este agendamento a vê como inativa e recusa.
 */
async function lockActiveResources(transaction: Prisma.TransactionClient, params: ScheduleAppointmentParams) {
  const services = await transaction.$queryRaw<{ isActive: boolean }[]>`
    SELECT "isActive" FROM "Service"
    WHERE id = ${params.serviceId} AND "clinicId" = ${params.clinicId}
    FOR SHARE
  `;
  if (!services[0]?.isActive) return false;
  if (!params.professionalId) return true;

  const professionals = await transaction.$queryRaw<{ isActive: boolean }[]>`
    SELECT "isActive" FROM "Professional"
    WHERE id = ${params.professionalId} AND "clinicId" = ${params.clinicId}
    FOR SHARE
  `;
  return Boolean(professionals[0]?.isActive);
}

function getErrorMetadata(error: unknown) {
  let current: unknown = error;

  while (current !== null && typeof current === "object") {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") {
      return { errorCode: code, errorName: error instanceof Error ? error.name : "UnknownError" };
    }
    current = (current as { cause?: unknown }).cause;
  }

  return { errorName: error instanceof Error ? error.name : "UnknownError" };
}

async function isValidBusinessSlot(
  transaction: Prisma.TransactionClient,
  params: ScheduleAppointmentParams,
  endTime: Date,
  appointmentId?: string,
): Promise<boolean> {
  const localInput = formatClinicDateTimeInput(params.startTime, params.timeZone);
  const day = localInput.slice(0, 10);
  const localTime = localInput.slice(11, 16);
  const { startOfToday: dayStart, startOfTomorrow: dayEnd } = getClinicDateBounds(params.timeZone, params.startTime);

  await lockClinicDay(transaction, params.clinicId, day);

  // Futuro, dentro do mesmo dia e com no máximo 1 ano de antecedência (o
  // limite de 15 min / 180 dias da reserva pública é aplicado na própria action).
  if (params.startTime <= new Date() || endTime > dayEnd || !isWithinStaffBookingHorizon(params.startTime)) {
    return false;
  }

  if (!(await lockActiveResources(transaction, params))) {
    return false;
  }

  const weekday = getClinicWeekday(day, params.timeZone);
  if (weekday === null) return false;

  const businessHour = await transaction.businessHour.findUnique({
    where: { clinicId_dayOfWeek: { clinicId: params.clinicId, dayOfWeek: weekday } },
  });
  if (!businessHour?.isOpen) return false;

  const professionalHour = params.professionalId
    ? await transaction.professionalAvailability.findUnique({
        where: { professionalId_dayOfWeek: { professionalId: params.professionalId, dayOfWeek: weekday } },
      })
    : null;

  // Mesma regra da grade exibida no agendamento (server/domain/working-hours.ts).
  const window = resolveWorkingWindow(businessHour, professionalHour);
  if (!window || !slotFitsWindow(window, minutesFromTime(localTime), params.serviceDuration)) {
    return false;
  }

  if (params.maxAppointmentsPerDay && params.maxAppointmentsPerDay > 0) {
    const count = await transaction.appointment.count({
      where: {
        clinicId: params.clinicId,
        ...(appointmentId ? { id: { not: appointmentId } } : {}),
        status: { not: "CANCELED" },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
    });
    if (count >= params.maxAppointmentsPerDay) return false;
  }

  return true;
}

export interface RescheduleAppointmentParams extends ScheduleAppointmentParams {
  appointmentId: string;
  cancellationToken: string;
}

export async function rescheduleScheduledAppointment(
  params: RescheduleAppointmentParams,
): Promise<Exclude<ScheduleAppointmentResult, { status: "success" }> | { status: "success" }> {
  const endTime = new Date(params.startTime.getTime() + params.serviceDuration * 60_000);
  let stage = "slot-validation";

  try {
    const result = await prisma.$transaction(async (transaction) => {
      if (!(await isValidBusinessSlot(transaction, params, endTime, params.appointmentId))) {
        return "conflict" as const;
      }

      const conflictConditions: Prisma.AppointmentWhereInput[] = [{ customerId: params.customerId }];
      conflictConditions.push(
        params.professionalId
          ? { professionalId: params.professionalId }
          : { serviceId: params.serviceId, professionalId: null },
      );

      const conflict = await transaction.appointment.findFirst({
        where: {
          clinicId: params.clinicId,
          id: { not: params.appointmentId },
          status: { not: "CANCELED" },
          startTime: { lt: endTime },
          endTime: { gt: params.startTime },
          OR: conflictConditions,
        },
        select: { id: true },
      });

      if (conflict) return "conflict" as const;

      stage = "appointment-update";
      const updated = await transaction.appointment.updateMany({
        where: {
          id: params.appointmentId,
          clinicId: params.clinicId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        data: {
          customerId: params.customerId,
          serviceId: params.serviceId,
          professionalId: params.professionalId,
          startTime: params.startTime,
          endTime,
          priceAtBooking: params.servicePrice,
          totalPrice: params.servicePrice,
          notes: params.notes,
        },
      });

      if (updated.count !== 1) return "error" as const;

      stage = "notification-outbox";
      await replaceAppointmentReminders(transaction, {
        appointmentId: params.appointmentId,
        clinicId: params.clinicId,
        clinicSlug: params.clinicSlug,
        clinicName: params.clinicName,
        timeZone: params.timeZone,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        channels: params.notificationChannels,
        serviceName: params.serviceName,
        startTime: params.startTime,
        cancellationToken: params.cancellationToken,
      });

      return "success" as const;
    });

    return { status: result };
  } catch (error) {
    if (isDoubleBookingError(error)) return { status: "conflict" };

    logger.error("Falha transacional ao reagendar atendimento", {
      stage,
      clinicId: params.clinicId,
      appointmentId: params.appointmentId,
      ...getErrorMetadata(error),
    });
    return { status: "error" };
  }
}

/**
 * Núcleo transacional de agendamento, compartilhado pela action autenticada
 * (createAppointment) e pelo agendamento público (createPublicAppointment).
 * Verifica conflito, cria o atendimento e enfileira as notificações (outbox)
 * na mesma transação; a exclusion constraint do banco é a garantia final
 * contra condições de corrida e é traduzida em `conflict`.
 */
export async function scheduleAppointment(params: ScheduleAppointmentParams): Promise<ScheduleAppointmentResult> {
  const endTime = new Date(params.startTime.getTime() + params.serviceDuration * 60_000);
  const cancellationToken = randomUUID();
  let stage = "slot-validation";

  try {
    const appointment = await prisma.$transaction(async (transaction) => {
      if (!(await isValidBusinessSlot(transaction, params, endTime))) {
        return null;
      }

      const existingCustomer = params.customerId
        ? { id: params.customerId }
        : await transaction.customer.findUnique({
            where: { clinicId_phone: { clinicId: params.clinicId, phone: params.customerPhone } },
            select: { id: true },
          });
      const conflictConditions: Prisma.AppointmentWhereInput[] = existingCustomer
        ? [{ customerId: existingCustomer.id }]
        : [];

      conflictConditions.push(
        params.professionalId
          ? { professionalId: params.professionalId }
          : { serviceId: params.serviceId, professionalId: null },
      );

      const conflictingAppointment = await transaction.appointment.findFirst({
        where: {
          clinicId: params.clinicId,
          status: { not: "CANCELED" },
          startTime: { lt: endTime },
          endTime: { gt: params.startTime },
          OR: conflictConditions,
        },
        select: { id: true },
      });

      if (conflictingAppointment) {
        return null;
      }

      stage = "customer-upsert";
      const customer = params.customerId
        ? {
            id: params.customerId,
            name: params.customerName,
            phone: params.customerPhone,
            email: params.customerEmail ?? null,
          }
        : await transaction.customer.upsert({
            where: { clinicId_phone: { clinicId: params.clinicId, phone: params.customerPhone } },
            create: {
              clinicId: params.clinicId,
              name: params.customerName,
              phone: params.customerPhone,
              email: params.customerEmail,
            },
            update: { name: params.customerName, ...(params.customerEmail ? { email: params.customerEmail } : {}) },
            select: { id: true, name: true, phone: true, email: true },
          });

      stage = "appointment-create";
      const created = await transaction.appointment.create({
        data: {
          clinicId: params.clinicId,
          customerId: customer.id,
          serviceId: params.serviceId,
          professionalId: params.professionalId,
          startTime: params.startTime,
          endTime,
          priceAtBooking: params.servicePrice,
          totalPrice: params.servicePrice,
          notes: params.notes,
          cancellationToken,
        },
      });

      stage = "notification-outbox";
      await enqueueAppointmentNotifications(transaction, {
        appointmentId: created.id,
        clinicId: params.clinicId,
        clinicSlug: params.clinicSlug,
        clinicName: params.clinicName,
        timeZone: params.timeZone,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        channels: params.notificationChannels,
        serviceName: params.serviceName,
        startTime: params.startTime,
        cancellationToken,
      });

      return created;
    });

    if (!appointment) {
      return { status: "conflict" };
    }

    return { status: "success", appointmentId: appointment.id, cancellationToken: appointment.cancellationToken };
  } catch (error) {
    if (isDoubleBookingError(error)) {
      return { status: "conflict" };
    }

    logger.error("Falha transacional ao criar agendamento", {
      stage,
      clinicId: params.clinicId,
      serviceId: params.serviceId,
      professionalId: params.professionalId ?? null,
      ...getErrorMetadata(error),
    });
    return { status: "error" };
  }
}
