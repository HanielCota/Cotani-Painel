import "server-only";

import prisma from "@/lib/prisma";
import { getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";
import { isWithinBookingWindow } from "@/config/booking";
import { findFreeSlots, getClinicWeekday, resolveWorkingWindow, type BusyInterval, type DaySchedule, type FreeSlot } from "@/server/domain/working-hours";

export interface AvailabilitySlot {
  /** Instante de início do slot em ISO 8601 (UTC). */
  startTime: string;
  /** Rótulo no formato HH:mm, na hora local do negócio. */
  label: string;
}

export interface GetAvailableSlotsParams {
  clinicId: string;
  timeZone: string;
  /** Duração do serviço em minutos. */
  serviceDuration: number;
  /** Data no formato YYYY-MM-DD, interpretada no fuso do negócio. */
  date: string;
  /**
   * Profissionais candidatos. Um só: a agenda dele. Vários ("sem preferência"):
   * a união dos horários livres de cada um. Vazio/omitido: calcula contra todos
   * os agendamentos do negócio (modo legado, sem profissional).
   */
  professionalIds?: readonly string[];
  /** Limite diário de atendimentos do negócio. Quando omitido, não aplica limite. */
  maxAppointmentsPerDay?: number | null;
}

interface DayAppointment extends BusyInterval {
  professionalId: string | null;
}

function reachedDailyLimit(appointmentsOfDay: number, maxAppointmentsPerDay: number | null | undefined) {
  return typeof maxAppointmentsPerDay === "number" && maxAppointmentsPerDay > 0 && appointmentsOfDay >= maxAppointmentsPerDay;
}

/** Ocupado para o profissional pedido; sem profissional, qualquer atendimento do negócio ocupa (modo legado). */
function busyFor(appointments: readonly DayAppointment[], professionalId: string | null) {
  return professionalId ? appointments.filter((appointment) => appointment.professionalId === professionalId) : appointments;
}

interface FreeSlotsOfDayInput {
  dateKey: string;
  timeZone: string;
  durationMinutes: number;
  businessHour: DaySchedule | null | undefined;
  /** Expediente individual do dia, por profissional. */
  professionalHours: ReadonlyMap<string, DaySchedule>;
  professionalIds: readonly string[];
  appointments: readonly DayAppointment[];
  now: Date;
  limit?: number;
}

/**
 * Horários livres do dia para ao menos um dos candidatos, sem repetição e em
 * ordem. Sem candidatos, usa o modo legado (agenda única do negócio).
 */
function freeSlotsOfDay(input: FreeSlotsOfDayInput): FreeSlot[] {
  const candidates: (string | null)[] = input.professionalIds.length > 0 ? [...input.professionalIds] : [null];
  const byStart = new Map<number, FreeSlot>();
  for (const professionalId of candidates) {
    const window = resolveWorkingWindow(input.businessHour, professionalId ? input.professionalHours.get(professionalId) : null);
    if (!window) continue;
    const slots = findFreeSlots({
      dateKey: input.dateKey,
      timeZone: input.timeZone,
      window,
      durationMinutes: input.durationMinutes,
      busy: busyFor(input.appointments, professionalId),
      isBookable: (startTime) => isWithinBookingWindow(startTime, input.now),
      limit: input.limit,
    });
    for (const slot of slots) byStart.set(slot.startTime.getTime(), slot);
    if (input.limit && byStart.size >= input.limit) break;
  }
  return [...byStart.values()].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Motor de disponibilidade: calcula os slots livres de um dia subtraindo os
 * atendimentos já marcados da grade do expediente (regras em
 * `server/domain/working-hours.ts`).
 *
 * Retorna `null` quando a data é inválida. A decisão de exibir ou não um slot
 * é derivada (ocupação + passado), nunca persistida - a verdade continua
 * sendo a tabela de atendimentos, e a garantia final contra concorrência é a
 * exclusion constraint do banco (ver services/scheduling.ts).
 */
export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailabilitySlot[] | null> {
  const dayStart = parseClinicDateTime(`${params.date}T00:00`, params.timeZone);
  const dayOfWeek = getClinicWeekday(params.date, params.timeZone);
  if (!dayStart || dayOfWeek === null) return null;

  const { startOfTomorrow: dayEnd } = getClinicDateBounds(params.timeZone, dayStart);

  const professionalIds = params.professionalIds ?? [];
  const [businessHour, professionalHours, appointments] = await Promise.all([
    prisma.businessHour.findUnique({
      where: { clinicId_dayOfWeek: { clinicId: params.clinicId, dayOfWeek } },
    }),
    professionalIds.length > 0 ? prisma.professionalAvailability.findMany({ where: { clinicId: params.clinicId, professionalId: { in: [...professionalIds] }, dayOfWeek } }) : [],
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

  if (reachedDailyLimit(appointments.length, params.maxAppointmentsPerDay)) return [];

  return freeSlotsOfDay({
    dateKey: params.date,
    timeZone: params.timeZone,
    durationMinutes: params.serviceDuration,
    businessHour,
    professionalHours: new Map(professionalHours.map((hour) => [hour.professionalId, hour])),
    professionalIds,
    appointments,
    now: new Date(),
  }).map((slot) => ({ startTime: slot.startTime.toISOString(), label: slot.label }));
}

export interface GetAvailableDatesParams {
  clinicId: string;
  timeZone: string;
  serviceDuration: number;
  yearMonth: string; // YYYY-MM
  /** Mesma semântica de `GetAvailableSlotsParams.professionalIds`. */
  professionalIds?: readonly string[];
  /** Limite diário de atendimentos do negócio. Quando omitido, não aplica limite. */
  maxAppointmentsPerDay?: number | null;
}

/**
 * Retorna todas as datas de um mês (formato YYYY-MM-DD) que possuem ao menos
 * um slot disponível no futuro, considerando expediente e agendamentos existentes.
 * Usada para desabilitar dias sem horários no calendário público.
 */
export async function getAvailableDatesInMonth(params: GetAvailableDatesParams): Promise<string[]> {
  const match = /^(\d{4})-(\d{2})$/.exec(params.yearMonth);
  if (!match) return [];

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return [];

  const monthStart = parseClinicDateTime(`${params.yearMonth}-01T00:00`, params.timeZone);
  const nextMonthKey = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEnd = parseClinicDateTime(`${nextMonthKey}-01T00:00`, params.timeZone);
  if (!monthStart || !monthEnd) return [];

  // Dias de calendário (não somas de 24 h): em fusos com horário de verão um
  // dia pode ter 23 ou 25 horas, e somar 24 h pulava ou repetia datas.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const professionalIds = params.professionalIds ?? [];
  const [businessHours, professionalHours, appointments] = await Promise.all([
    prisma.businessHour.findMany({ where: { clinicId: params.clinicId } }),
    professionalIds.length > 0 ? prisma.professionalAvailability.findMany({ where: { clinicId: params.clinicId, professionalId: { in: [...professionalIds] } } }) : [],
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
  const dateKey = (day: number) => `${params.yearMonth}-${String(day).padStart(2, "0")}`;
  const availableDates: string[] = [];
  const now = new Date();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(day);
    const dayStart = parseClinicDateTime(`${key}T00:00`, params.timeZone);
    const dayEnd = day < daysInMonth ? parseClinicDateTime(`${dateKey(day + 1)}T00:00`, params.timeZone) : monthEnd;
    const dayOfWeek = getClinicWeekday(key, params.timeZone);
    if (!dayStart || !dayEnd || dayOfWeek === null) continue;

    const appointmentsOfDay = appointments.filter((appointment) => appointment.startTime < dayEnd && appointment.endTime > dayStart);
    if (reachedDailyLimit(appointmentsOfDay.length, params.maxAppointmentsPerDay)) continue;

    const [firstFree] = freeSlotsOfDay({
      dateKey: key,
      timeZone: params.timeZone,
      durationMinutes: params.serviceDuration,
      businessHour: businessHoursByDay.get(dayOfWeek),
      professionalHours: new Map(professionalHours.filter((hour) => hour.dayOfWeek === dayOfWeek).map((hour) => [hour.professionalId, hour])),
      professionalIds,
      appointments: appointmentsOfDay,
      now,
      limit: 1,
    });
    if (firstFree) availableDates.push(key);
  }

  return availableDates;
}
