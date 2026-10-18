import { describe, expect, it } from "vitest";

import {
  candidateSlotStarts,
  findFreeSlots,
  formatTimeLabel,
  getClinicWeekday,
  minutesFromTime,
  resolveWorkingWindow,
  slotFitsWindow,
  validateDaySchedule,
} from "./working-hours";

const business = { isOpen: true, openTime: "09:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" };

describe("resolveWorkingWindow", () => {
  it("usa o expediente do negócio quando não há profissional", () => {
    expect(resolveWorkingWindow(business)).toEqual({ open: 540, close: 1080, breaks: [[720, 780]] });
  });

  it("faz a interseção com o horário do profissional e soma os intervalos", () => {
    const professional = {
      isOpen: true,
      openTime: "10:00",
      closeTime: "20:00",
      breakStart: "15:00",
      breakEnd: "15:30",
    };
    expect(resolveWorkingWindow(business, professional)).toEqual({
      open: 600,
      close: 1080,
      breaks: [
        [720, 780],
        [900, 930],
      ],
    });
  });

  it("fecha o dia quando o negócio ou o profissional não atendem, ou a interseção é vazia", () => {
    expect(resolveWorkingWindow({ ...business, isOpen: false })).toBeNull();
    expect(resolveWorkingWindow(business, { ...business, isOpen: false })).toBeNull();
    expect(resolveWorkingWindow(business, { isOpen: true, openTime: "19:00", closeTime: "21:00" })).toBeNull();
    expect(resolveWorkingWindow(null)).toBeNull();
  });
});

/** Janela de expediente que o teste exige existir. */
function requireWindow(day: Parameters<typeof resolveWorkingWindow>[0]) {
  const window = resolveWorkingWindow(day);
  if (!window) throw new Error("expediente esperado");
  return window;
}

describe("grade de horários", () => {
  const window = requireWindow(business);

  it("aceita só horários alinhados, dentro do expediente e fora do intervalo", () => {
    expect(slotFitsWindow(window, minutesFromTime("09:00"), 60)).toBe(true);
    expect(slotFitsWindow(window, minutesFromTime("09:15"), 30)).toBe(false); // desalinhado
    expect(slotFitsWindow(window, minutesFromTime("11:30"), 60)).toBe(false); // cruza o almoço
    expect(slotFitsWindow(window, minutesFromTime("17:30"), 60)).toBe(false); // passa do fechamento
    expect(slotFitsWindow(window, minutesFromTime("08:30"), 30)).toBe(false); // antes da abertura
  });

  it("gera os inícios possíveis respeitando duração e intervalo", () => {
    const starts = candidateSlotStarts(window, 60).map(formatTimeLabel);
    expect(starts).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
    ]);
  });

  it("remove horários ocupados e respeita o filtro de reserva", () => {
    const busy = [{ startTime: new Date("2026-10-20T12:00:00.000Z"), endTime: new Date("2026-10-20T13:00:00.000Z") }]; // 09:00-10:00 em SP
    const slots = findFreeSlots({
      dateKey: "2026-10-20",
      timeZone: "America/Sao_Paulo",
      window: requireWindow({ isOpen: true, openTime: "09:00", closeTime: "11:00" }),
      durationMinutes: 30,
      busy,
      isBookable: (start) => start.toISOString() !== "2026-10-20T13:30:00.000Z", // 10:30 bloqueado
    });
    expect(slots.map((slot) => slot.label)).toEqual(["10:00"]);
  });

  it("para no limite pedido", () => {
    const slots = findFreeSlots({
      dateKey: "2026-10-20",
      timeZone: "America/Sao_Paulo",
      window,
      durationMinutes: 30,
      busy: [],
      limit: 1,
    });
    expect(slots).toHaveLength(1);
  });
});

describe("getClinicWeekday", () => {
  it("calcula o dia da semana no fuso do negócio, inclusive em dia de horário de verão", () => {
    expect(getClinicWeekday("2026-10-11", "America/Sao_Paulo")).toBe(0); // domingo
    expect(getClinicWeekday("2027-03-14", "America/New_York")).toBe(0); // domingo da troca de horário
    expect(getClinicWeekday("2026-02-30", "America/Sao_Paulo")).toBeNull();
  });
});

describe("validateDaySchedule", () => {
  it("aponta erros de abertura, fechamento e intervalo com o nome do dia", () => {
    expect(validateDaySchedule({ dayOfWeek: 1, ...business })).toBeNull();
    expect(validateDaySchedule({ dayOfWeek: 1, ...business, isOpen: false, openTime: "20:00" })).toBeNull();
    expect(validateDaySchedule({ dayOfWeek: 1, ...business, openTime: "18:00" })).toContain("Segunda");
    expect(validateDaySchedule({ dayOfWeek: 2, ...business, breakStart: "13:00", breakEnd: "12:00" })).toContain(
      "início do intervalo",
    );
    expect(validateDaySchedule({ dayOfWeek: 3, ...business, breakStart: "08:00", breakEnd: "09:30" })).toContain(
      "dentro do expediente",
    );
  });
});
