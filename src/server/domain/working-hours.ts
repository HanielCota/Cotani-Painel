import { parseClinicDateTime } from "@/lib/timezone";

/**
 * Regras de expediente e de grade de horários, sem acesso a banco.
 *
 * Fonte única para: horários exibidos no agendamento (availability), validação
 * da reserva (scheduling) e validação do expediente salvo (business-hours).
 */

/** Resolução da grade: os horários começam a cada 30 min a partir da abertura. */
export const SLOT_STEP_MINUTES = 30;

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
}

/** Janela de trabalho de um dia, em minutos desde 00:00 no fuso do negócio. */
export interface WorkingWindow {
  open: number;
  close: number;
  breaks: Array<[number, number]>;
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTimeLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const WEEKDAY_BY_SHORT_NAME: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Dia da semana (0 = domingo) de uma data YYYY-MM-DD no fuso do negócio.
 * Usa o meio-dia local: a meia-noite pode não existir em dias de troca de
 * horário de verão.
 */
export function getClinicWeekday(dateKey: string, timeZone: string): number | null {
  const noon = parseClinicDateTime(`${dateKey}T12:00`, timeZone);
  if (!noon) return null;
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return WEEKDAY_BY_SHORT_NAME[name] ?? null;
}

function breakOf(schedule: DaySchedule): [number, number] | null {
  return schedule.breakStart && schedule.breakEnd
    ? [minutesFromTime(schedule.breakStart), minutesFromTime(schedule.breakEnd)]
    : null;
}

/**
 * Janela de trabalho efetiva: interseção do expediente do negócio com o do
 * profissional (quando houver), somando os intervalos dos dois. `null` quando
 * o negócio ou o profissional não atendem no dia.
 */
export function resolveWorkingWindow(business: DaySchedule | null | undefined, professional?: DaySchedule | null): WorkingWindow | null {
  if (!business?.isOpen) return null;
  if (professional && !professional.isOpen) return null;

  const open = Math.max(minutesFromTime(business.openTime), professional ? minutesFromTime(professional.openTime) : 0);
  const close = Math.min(minutesFromTime(business.closeTime), professional ? minutesFromTime(professional.closeTime) : 24 * 60);
  if (open >= close) return null;

  const breaks = [breakOf(business), professional ? breakOf(professional) : null].filter(
    (value): value is [number, number] => value !== null,
  );
  return { open, close, breaks };
}

/** O atendimento [início, início + duração) cabe na janela, alinhado à grade e sem cruzar intervalos? */
export function slotFitsWindow(window: WorkingWindow, startMinutes: number, durationMinutes: number): boolean {
  const end = startMinutes + durationMinutes;
  if (startMinutes < window.open || end > window.close) return false;
  if ((startMinutes - window.open) % SLOT_STEP_MINUTES !== 0) return false;
  return !window.breaks.some(([breakStart, breakEnd]) => startMinutes < breakEnd && end > breakStart);
}

/** Inícios possíveis na grade do dia (em minutos), já sem os que cruzam intervalos. */
export function candidateSlotStarts(window: WorkingWindow, durationMinutes: number): number[] {
  const starts: number[] = [];
  for (let minutes = window.open; minutes + durationMinutes <= window.close; minutes += SLOT_STEP_MINUTES) {
    if (slotFitsWindow(window, minutes, durationMinutes)) starts.push(minutes);
  }
  return starts;
}

export interface BusyInterval {
  startTime: Date;
  endTime: Date;
}

export interface FreeSlot {
  /** Início em UTC. */
  startTime: Date;
  /** HH:mm no fuso do negócio. */
  label: string;
}

interface FindFreeSlotsInput {
  dateKey: string;
  timeZone: string;
  window: WorkingWindow;
  durationMinutes: number;
  busy: readonly BusyInterval[];
  /** Filtro extra por horário (ex.: janela de antecedência da reserva pública). */
  isBookable?: (startTime: Date) => boolean;
  /** Para no primeiro N livres (ex.: 1 para saber se o dia tem vaga). */
  limit?: number;
}

/** Horários livres de um dia: grade da janela menos os períodos ocupados. */
export function findFreeSlots({ dateKey, timeZone, window, durationMinutes, busy, isBookable, limit }: FindFreeSlotsInput): FreeSlot[] {
  const slots: FreeSlot[] = [];
  for (const minutes of candidateSlotStarts(window, durationMinutes)) {
    const label = formatTimeLabel(minutes);
    const startTime = parseClinicDateTime(`${dateKey}T${label}`, timeZone);
    if (!startTime || (isBookable && !isBookable(startTime))) continue;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    if (busy.some((interval) => startTime < interval.endTime && endTime > interval.startTime)) continue;
    slots.push({ startTime, label });
    if (limit && slots.length >= limit) break;
  }
  return slots;
}

/** Erro de um dia de expediente informado (abertura/fechamento/intervalo), ou `null` se válido. */
export function validateDaySchedule(day: DaySchedule & { dayOfWeek: number }): string | null {
  if (!day.isOpen) return null;
  const label = WEEKDAY_LABELS[day.dayOfWeek] ?? "Dia inválido";
  const open = minutesFromTime(day.openTime);
  const close = minutesFromTime(day.closeTime);
  if (open >= close) return `O horário de abertura deve ser anterior ao de fechamento (${label}).`;
  const pause = breakOf(day);
  if (pause) {
    if (pause[0] >= pause[1]) return `O início do intervalo deve ser anterior ao fim (${label}).`;
    if (pause[0] < open || pause[1] > close) return `O intervalo deve estar dentro do expediente (${label}).`;
  }
  return null;
}
