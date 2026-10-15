import type { AgendaGridColumn } from "@/components/dashboard/agenda/agenda-time-grid";
import { localDateAndMinutes } from "@/lib/agenda-layout";
import { addDaysToDateKey } from "@/lib/timezone";
import type { AgendaAppointment, AgendaRange } from "@/types";

export function dateLabel(dateKey: string, options: Intl.DateTimeFormatOptions) {
  // Meio-dia UTC: o dia de calendário não muda em nenhum fuso das Américas.
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function itemsOnDate(items: AgendaAppointment[], dateKey: string, timeZone: string) {
  return items.filter((item) => localDateAndMinutes(item.startTime, timeZone).dateKey === dateKey);
}

export function visibleSortedItems(items: AgendaAppointment[], showCanceled: boolean) {
  return items
    .filter((item) => showCanceled || item.status !== "CANCELED")
    .sort((first, second) => first.startTime.localeCompare(second.startTime));
}

export function buildWeekColumns(dateKeys: string[], items: AgendaAppointment[], timeZone: string, todayDateKey: string): AgendaGridColumn[] {
  return dateKeys.map((dateKey) => ({
    key: dateKey,
    dateKey,
    title: dateLabel(dateKey, { weekday: "short", day: "numeric" }).replace(".", ""),
    items: itemsOnDate(items, dateKey, timeZone),
    highlight: dateKey === todayDateKey,
  }));
}

/** Profissionais ativos mais quem já saiu, se tiver atendimento no dia. */
function professionalNames(dayItems: AgendaAppointment[], professionals: AgendaRange["professionals"]) {
  const names = new Map(professionals.map((professional) => [professional.id, professional.name]));
  for (const item of dayItems) {
    if (!item.professionalId || names.has(item.professionalId)) continue;

    names.set(item.professionalId, item.professionalName ?? "Profissional");
  }
  return names;
}

/** Dia: uma coluna por profissional (inclui quem já saiu, se tiver atendimento) e "Sem profissional". */
export function buildDayColumns(dayItems: AgendaAppointment[], professionals: AgendaRange["professionals"], anchor: string): AgendaGridColumn[] {
  const professionalColumns: AgendaGridColumn[] = [...professionalNames(dayItems, professionals)].map(([id, name]) => ({
    key: id,
    dateKey: anchor,
    title: name,
    items: dayItems.filter((item) => item.professionalId === id),
  }));
  const unassigned = dayItems.filter((item) => !item.professionalId);
  if (unassigned.length === 0 && professionalColumns.length > 0) return professionalColumns;

  const unassignedColumn: AgendaGridColumn = {
    key: "sem-profissional",
    dateKey: anchor,
    title: professionalColumns.length ? "Sem profissional" : "Atendimentos",
    items: unassigned,
  };
  return [...professionalColumns, unassignedColumn];
}

export function itemMinuteSpans(items: AgendaAppointment[], timeZone: string) {
  return items.map((item) => {
    const start = localDateAndMinutes(item.startTime, timeZone).minutes;
    const end = localDateAndMinutes(item.endTime, timeZone).minutes;
    return { start, end: end > start ? end : 24 * 60 };
  });
}

export function periodTitle(isWeek: boolean, from: string, anchor: string) {
  if (!isWeek) return dateLabel(anchor, { weekday: "long", day: "numeric", month: "long" });

  return `${dateLabel(from, { day: "numeric", month: "short" })} – ${dateLabel(addDaysToDateKey(from, 6), { day: "numeric", month: "short", year: "numeric" })}`;
}
