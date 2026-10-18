interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  ) as Record<keyof ZonedDateParts, number>;
}

function zonedDateTimeToUtc(date: ZonedDateParts, timeZone: string) {
  const target = Date.UTC(date.year, date.month - 1, date.day, date.hour, date.minute, date.second);
  let instant = target;

  for (let index = 0; index < 2; index += 1) {
    const actual = getZonedDateParts(new Date(instant), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant = target - (actualAsUtc - instant);
  }

  return new Date(instant);
}

export function parseClinicDateTime(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const date = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  };
  const validationDate = new Date(Date.UTC(date.year, date.month - 1, date.day, date.hour, date.minute));

  if (
    validationDate.getUTCFullYear() !== date.year ||
    validationDate.getUTCMonth() + 1 !== date.month ||
    validationDate.getUTCDate() !== date.day ||
    date.hour > 23 ||
    date.minute > 59
  ) {
    return null;
  }

  return zonedDateTimeToUtc(date, timeZone);
}

export function formatClinicDateTimeInput(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatClinicDateKey(date: Date, timeZone: string) {
  return formatClinicDateTimeInput(date, timeZone).slice(0, 10);
}

export function getClinicDateBounds(timeZone: string, now = new Date()) {
  const current = getZonedDateParts(now, timeZone);
  const startOfToday = zonedDateTimeToUtc({ ...current, hour: 0, minute: 0, second: 0 }, timeZone);
  const tomorrow = getZonedDateParts(new Date(Date.UTC(current.year, current.month - 1, current.day + 1)), "UTC");
  const startOfTomorrow = zonedDateTimeToUtc({ ...tomorrow, hour: 0, minute: 0, second: 0 }, timeZone);
  const startOfMonth = zonedDateTimeToUtc({ ...current, day: 1, hour: 0, minute: 0, second: 0 }, timeZone);
  // current.month é 1-based; Date.UTC espera 0-based, então isto cai no dia 1 do mês seguinte (com rollover em dezembro).
  const nextMonth = getZonedDateParts(new Date(Date.UTC(current.year, current.month, 1)), "UTC");
  const startOfNextMonth = zonedDateTimeToUtc({ ...nextMonth, hour: 0, minute: 0, second: 0 }, timeZone);
  const previousMonth = getZonedDateParts(new Date(Date.UTC(current.year, current.month - 2, 1)), "UTC");
  const startOfPreviousMonth = zonedDateTimeToUtc({ ...previousMonth, hour: 0, minute: 0, second: 0 }, timeZone);

  return { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth, startOfPreviousMonth };
}

export interface MonthlyBounds {
  label: string;
  start: Date;
  end: Date;
}

export function getClinicMonthlyBounds(timeZone: string, months: number, now = new Date()): MonthlyBounds[] {
  const current = getZonedDateParts(now, timeZone);
  const result: MonthlyBounds[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthIndex = current.month - 1 - offset;
    const monthDate = new Date(Date.UTC(current.year, monthIndex, 1));
    const monthParts = getZonedDateParts(monthDate, "UTC");
    const start = zonedDateTimeToUtc({ ...monthParts, hour: 0, minute: 0, second: 0 }, timeZone);
    const nextMonthDate = new Date(Date.UTC(monthParts.year, monthParts.month, 1));
    const nextMonthParts = getZonedDateParts(nextMonthDate, "UTC");
    const end = zonedDateTimeToUtc({ ...nextMonthParts, hour: 0, minute: 0, second: 0 }, timeZone);

    result.push({
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone }).format(start),
      start,
      end,
    });
  }

  return result;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte um valor de `<input type="date">` (YYYY-MM-DD) num instante ao
 * meio-dia do fuso da loja. Ao contrário de `new Date("YYYY-MM-DD")` (00:00
 * UTC, ou seja, véspera em horário de Brasília), o resultado cai no mesmo dia
 * tanto no fuso da loja quanto em UTC - por isso filtros por período e a
 * exibição com `formatDateOnly` concordam sobre a data escolhida.
 */
export function parseClinicDateOnly(value: string, timeZone: string) {
  return DATE_ONLY_PATTERN.test(value) ? parseClinicDateTime(`${value}T12:00`, timeZone) : null;
}

/** Soma dias a uma data de calendário YYYY-MM-DD (independe de fuso). */
export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data de calendário YYYY-MM-DD. */
export function weekdayOfDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Segunda-feira da semana de uma data de calendário. */
export function startOfWeekDateKey(dateKey: string) {
  return addDaysToDateKey(dateKey, -((weekdayOfDateKey(dateKey) + 6) % 7));
}

export function isDateKey(value: string | null | undefined): value is string {
  return Boolean(value && DATE_ONLY_PATTERN.test(value) && parseClinicDateTime(`${value}T12:00`, "UTC"));
}

function nextDateKey(dateKey: string) {
  return addDaysToDateKey(dateKey, 1);
}

/**
 * Converte o filtro `from`/`to` (YYYY-MM-DD, ambos inclusivos) em limites
 * `[from, to)` no fuso da loja. Valores ausentes ou inválidos ficam indefinidos.
 */
export function parseClinicDateRange(fromValue: string | null | undefined, toValue: string | null | undefined, timeZone: string) {
  const from = isDateKey(fromValue) ? parseClinicDateTime(`${fromValue}T00:00`, timeZone) ?? undefined : undefined;
  const to = isDateKey(toValue) ? parseClinicDateTime(`${nextDateKey(toValue)}T00:00`, timeZone) ?? undefined : undefined;
  return { from, to };
}
