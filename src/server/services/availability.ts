import prisma from "@/lib/prisma";
import { getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";

// Resolução mínima da grade de horários. Os slots são gerados a cada 30 minutos
// dentro do expediente configurado, desde que caibam a duração do serviço.
const SLOT_STEP_MINUTES = 30;

export interface AvailabilitySlot {
  /** Instante de início do slot em ISO 8601 (UTC). */
  startTime: string;
  /** Rótulo no formato HH:mm, na hora local da barbearia. */
  label: string;
}

export interface GetAvailableSlotsParams {
  clinicId: string;
  timeZone: string;
  /** Duração do serviço em minutos. */
  serviceDuration: number;
  /** Data no formato YYYY-MM-DD, interpretada no fuso da barbearia. */
  date: string;
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTimeLabel(minutes: number): string {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

const weekdayShortToNumber: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getClinicDayOfWeek(dateString: string, timeZone: string): number {
  const dayStart = parseClinicDateTime(`${dateString}T00:00`, timeZone);

  if (!dayStart) {
    return new Date().getDay();
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).formatToParts(dayStart);

  const weekdayPart = parts.find((part) => part.type === "weekday")?.value;

  return weekdayShortToNumber[weekdayPart ?? ""] ?? 0;
}

/**
 * Motor de disponibilidade: calcula os slots livres de um dia subtraindo os
 * atendimentos já marcados da grade de candidatos do expediente configurado.
 *
 * Retorna `null` quando a data é inválida. A decisão de exibir ou não um slot
 * é derivada (ocupação + passado), nunca persistida — a verdade continua
 * sendo a tabela de atendimentos, e a garantia final contra concorrência é a
 * exclusion constraint do banco (ver services/scheduling.ts).
 */
export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailabilitySlot[] | null> {
  const dayStart = parseClinicDateTime(`${params.date}T00:00`, params.timeZone);

  if (!dayStart) {
    return null;
  }

  const { startOfTomorrow: dayEnd } = getClinicDateBounds(params.timeZone, dayStart);
  const dayOfWeek = getClinicDayOfWeek(params.date, params.timeZone);

  const [businessHour, appointments] = await Promise.all([
    prisma.businessHour.findUnique({
      where: { clinicId_dayOfWeek: { clinicId: params.clinicId, dayOfWeek } },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: params.clinicId,
        status: { not: "CANCELED" },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  if (!businessHour || !businessHour.isOpen) {
    return [];
  }

  const now = new Date();
  const openMinutes = minutesFromTime(businessHour.openTime);
  const closeMinutes = minutesFromTime(businessHour.closeTime);
  const breakStartMinutes = businessHour.breakStart ? minutesFromTime(businessHour.breakStart) : null;
  const breakEndMinutes = businessHour.breakEnd ? minutesFromTime(businessHour.breakEnd) : null;
  const slots: AvailabilitySlot[] = [];

  for (
    let minutes = openMinutes;
    minutes + params.serviceDuration <= closeMinutes;
    minutes += SLOT_STEP_MINUTES
  ) {
    const slotEndMinutes = minutes + params.serviceDuration;

    // O slot não pode cruzar o intervalo de almoço.
    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      if (minutes < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
        continue;
      }
    }

    const label = formatTimeLabel(minutes);
    const startTime = parseClinicDateTime(`${params.date}T${label}`, params.timeZone);

    if (!startTime || startTime <= now) {
      continue;
    }

    const endTime = new Date(startTime.getTime() + params.serviceDuration * 60_000);
    const overlaps = appointments.some((appointment) => startTime < appointment.endTime && endTime > appointment.startTime);

    if (overlaps) {
      continue;
    }

    slots.push({ startTime: startTime.toISOString(), label });
  }

  return slots;
}
