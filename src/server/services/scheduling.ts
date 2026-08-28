import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { NotificationChannel } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput, getClinicDateBounds } from "@/lib/timezone";
import { enqueueAppointmentNotifications, replaceAppointmentReminders } from "@/server/services/notifications";

export const DOUBLE_BOOKING_MESSAGE = "Horário indisponível. Por favor, escolha outro.";

/**
 * Detecta violação das exclusion constraints de agendamento
 * ("Appointment_customer_no_overlap" / "Appointment_service_no_overlap", SQLSTATE 23P01).
 * Com o driver adapter do Prisma 7, o erro chega como DriverAdapterError envolvendo
 * o erro original do pg na cadeia de `cause` — por isso a varredura é estrutural.
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
  professionalId?: string;
  maxAppointmentsPerDay?: number | null;
}

export type ScheduleAppointmentResult =
  | { status: "success"; appointmentId: string; cancellationToken: string }
  | { status: "conflict" }
  | { status: "error" };

const SLOT_STEP_MINUTES = 30;

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Serializa alterações da agenda da mesma barbearia/dia. A trava evita que
 * duas transações ultrapassem juntas o limite diário ou passem pelo mesmo
 * check de disponibilidade antes de gravar.
 */
async function lockClinicDay(transaction: Prisma.TransactionClient, clinicId: string, day: string) {
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${clinicId}:${day}`}))`;
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
  const { startOfToday: dayStart, startOfTomorrow: dayEnd } = getClinicDateBounds(
    params.timeZone,
    params.startTime,
  );

  await lockClinicDay(transaction, params.clinicId, day);

  if (params.startTime <= new Date() || endTime > dayEnd) {
    return false;
  }

  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: params.timeZone,
    weekday: "short",
  }).format(params.startTime);
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[
    weekdayLabel as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
  ];

  const businessHour = await transaction.businessHour.findUnique({
    where: { clinicId_dayOfWeek: { clinicId: params.clinicId, dayOfWeek: weekday } },
  });

  if (!businessHour?.isOpen) return false;

  const startMinutes = minutesFromTime(localTime);
  const endMinutes = startMinutes + params.serviceDuration;
  const openMinutes = minutesFromTime(businessHour.openTime);
  const closeMinutes = minutesFromTime(businessHour.closeTime);

  if (
    startMinutes < openMinutes ||
    endMinutes > closeMinutes ||
    (startMinutes - openMinutes) % SLOT_STEP_MINUTES !== 0
  ) {
    return false;
  }

  if (businessHour.breakStart && businessHour.breakEnd) {
    const breakStart = minutesFromTime(businessHour.breakStart);
    const breakEnd = minutesFromTime(businessHour.breakEnd);
    if (startMinutes < breakEnd && endMinutes > breakStart) return false;
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

      await transaction.appointment.update({
        where: { id: params.appointmentId },
        data: { startTime: params.startTime, endTime },
      });

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

  try {
    const appointment = await prisma.$transaction(async (transaction) => {
      if (!(await isValidBusinessSlot(transaction, params, endTime))) {
        return null;
      }

      const existingCustomer = params.customerId
        ? { id: params.customerId }
        : await transaction.customer.findUnique({ where: { clinicId_phone: { clinicId: params.clinicId, phone: params.customerPhone } }, select: { id: true } });
      const conflictConditions: Prisma.AppointmentWhereInput[] = existingCustomer ? [{ customerId: existingCustomer.id }] : [];

      if (params.professionalId) {
        conflictConditions.push({ professionalId: params.professionalId });
      } else {
        conflictConditions.push({ serviceId: params.serviceId, professionalId: null });
      }

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

      const customer = params.customerId
        ? { id: params.customerId, name: params.customerName, phone: params.customerPhone, email: params.customerEmail ?? null }
        : await transaction.customer.upsert({
            where: { clinicId_phone: { clinicId: params.clinicId, phone: params.customerPhone } },
            create: { clinicId: params.clinicId, name: params.customerName, phone: params.customerPhone, email: params.customerEmail },
            update: { name: params.customerName, ...(params.customerEmail ? { email: params.customerEmail } : {}) },
            select: { id: true, name: true, phone: true, email: true },
          });

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

    return { status: "error" };
  }
}
