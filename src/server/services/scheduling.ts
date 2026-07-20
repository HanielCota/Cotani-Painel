import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { enqueueAppointmentNotifications } from "@/server/services/notifications";

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
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  startTime: Date;
  notes?: string;
  professionalId?: string;
}

export type ScheduleAppointmentResult =
  | { status: "success"; appointmentId: string; cancellationToken: string }
  | { status: "conflict" }
  | { status: "error" };

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
      const conflictConditions: Array<Record<string, unknown>> = [{ customerId: params.customerId }];

      if (params.professionalId) {
        conflictConditions.push({ professionalId: params.professionalId });
      } else {
        conflictConditions.push({ serviceId: params.serviceId });
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

      const created = await transaction.appointment.create({
        data: {
          clinicId: params.clinicId,
          customerId: params.customerId,
          serviceId: params.serviceId,
          professionalId: params.professionalId,
          startTime: params.startTime,
          endTime,
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
        customerName: params.customerName,
        customerPhone: params.customerPhone,
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
