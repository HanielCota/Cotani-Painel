import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput, getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";
import { isWithinBookingWindow } from "@/config/booking";

// Resolução mínima da grade de horários. Os slots são gerados a cada 30 minutos
// dentro do expediente configurado, desde que caibam a duração do serviço.
const SLOT_STEP_MINUTES = 30;

export interface AvailabilitySlot {
  /** Instante de início do slot em ISO 8601 (UTC). */
  startTime: string;
  /** Rótulo no formato HH:mm, na hora local da loja. */
  label: string;
}

export interface GetAvailableSlotsParams {
  clinicId: string;
  timeZone: string;
  /** Duração do serviço em minutos. */
  serviceDuration: number;
  /** Data no formato YYYY-MM-DD, interpretada no fuso da loja. */
  date: string;
  /** Profissional responsável pelos slots. Quando omitido, calcula contra todos os agendamentos da loja (modo legado). */
  professionalId?: string;
  /** Limite diário de atendimentos da loja. Quando omitido, não aplica limite. */
  maxAppointmentsPerDay?: number | null;
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
      select: { startTime: true, endTime: true, professionalId: true },
    }),
  ]);

  if (!businessHour || !businessHour.isOpen) {
    return [];
  }

  const appointmentCount = appointments.length;
  const hasReachedDailyLimit =
    typeof params.maxAppointmentsPerDay === "number" && params.maxAppointmentsPerDay > 0 && appointmentCount >= params.maxAppointmentsPerDay;

  if (hasReachedDailyLimit) {
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

    if (!startTime || !isWithinBookingWindow(startTime, now)) {
      continue;
    }

    const endTime = new Date(startTime.getTime() + params.serviceDuration * 60_000);
    const overlaps = appointments.some(
      (appointment) =>
        (!params.professionalId || appointment.professionalId === params.professionalId) &&
        startTime < appointment.endTime &&
        endTime > appointment.startTime,
    );

    if (overlaps) {
      continue;
    }

    slots.push({ startTime: startTime.toISOString(), label });
  }

  return slots;
}

export interface GetAvailableDatesParams {
  clinicId: string;
  timeZone: string;
  serviceDuration: number;
  yearMonth: string; // YYYY-MM
  professionalId?: string;
  /** Limite diário de atendimentos da loja. Quando omitido, não aplica limite. */
  maxAppointmentsPerDay?: number | null;
}

/**
 * Retorna todas as datas de um mês (formato YYYY-MM-DD) que possuem ao menos
 * um slot disponível no futuro, considerando expediente e agendamentos existentes.
 * Usada para desabilitar dias sem horários no calendário público.
 */
export async function getAvailableDatesInMonth(params: GetAvailableDatesParams): Promise<string[]> {
  const match = /^(\d{4})-(\d{2})$/.exec(params.yearMonth);

  if (!match) {
    return [];
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return [];
  }

  const monthStart = parseClinicDateTime(`${params.yearMonth}-01T00:00`, params.timeZone);

  if (!monthStart) {
    return [];
  }

  const nextMonthString = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEnd = parseClinicDateTime(`${nextMonthString}-01T00:00`, params.timeZone);

  if (!monthEnd) {
    return [];
  }

  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
  const [businessHours, appointments] = await Promise.all([
    prisma.businessHour.findMany({ where: { clinicId: params.clinicId } }),
    prisma.appointment.findMany({
      where: {
        clinicId: params.clinicId,
        status: { not: "CANCELED" },
        startTime: { lt: monthEnd },
        endTime: { gt: monthStart },
      },
      select: { startTime: true, endTime: true, professionalId: true },
    }),
  ]);

  const businessHoursByDay = new Map(businessHours.map((hour) => [hour.dayOfWeek, hour]));
  const availableDates: string[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < daysInMonth; dayOffset += 1) {
    const dayDate = new Date(monthStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayString = formatClinicDateTimeInput(dayDate, params.timeZone).slice(0, 10);
    const dayOfWeek = getClinicDayOfWeek(dayString, params.timeZone);
    const businessHour = businessHoursByDay.get(dayOfWeek);

    if (!businessHour || !businessHour.isOpen) {
      continue;
    }

    const openMinutes = minutesFromTime(businessHour.openTime);
    const closeMinutes = minutesFromTime(businessHour.closeTime);
    const breakStartMinutes = businessHour.breakStart ? minutesFromTime(businessHour.breakStart) : null;
    const breakEndMinutes = businessHour.breakEnd ? minutesFromTime(businessHour.breakEnd) : null;
    const allDayAppointments = appointments.filter(
      (appointment) => appointment.startTime < new Date(dayDate.getTime() + 24 * 60 * 60 * 1000) && appointment.endTime > dayDate,
    );
    const dayAppointments = params.professionalId
      ? allDayAppointments.filter((appointment) => appointment.professionalId === params.professionalId)
      : allDayAppointments;

    const hasReachedDailyLimit =
      typeof params.maxAppointmentsPerDay === "number" && params.maxAppointmentsPerDay > 0 && allDayAppointments.length >= params.maxAppointmentsPerDay;

    if (hasReachedDailyLimit) {
      continue;
    }

    for (
      let minutes = openMinutes;
      minutes + params.serviceDuration <= closeMinutes;
      minutes += SLOT_STEP_MINUTES
    ) {
      const slotEndMinutes = minutes + params.serviceDuration;

      if (breakStartMinutes !== null && breakEndMinutes !== null) {
        if (minutes < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
          continue;
        }
      }

      const label = formatTimeLabel(minutes);
      const startTime = parseClinicDateTime(`${dayString}T${label}`, params.timeZone);

      if (!startTime || !isWithinBookingWindow(startTime, now)) {
        continue;
      }

      const endTime = new Date(startTime.getTime() + params.serviceDuration * 60_000);
      const overlaps = dayAppointments.some(
        (appointment) => startTime < appointment.endTime && endTime > appointment.startTime,
      );

      if (!overlaps) {
        availableDates.push(dayString);
        break;
      }
    }
  }

  return availableDates;
}
