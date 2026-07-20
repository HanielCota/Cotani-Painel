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
