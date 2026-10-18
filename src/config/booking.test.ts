import { describe, expect, it } from "vitest";

import { isWithinBookingWindow, isWithinStaffBookingHorizon } from "./booking";

const now = new Date("2026-10-08T12:00:00.000Z");
const plus = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

describe("janelas de agendamento", () => {
  it("reserva pública: mínimo de 15 min e máximo de 180 dias", () => {
    expect(isWithinBookingWindow(plus(10), now)).toBe(false);
    expect(isWithinBookingWindow(plus(15), now)).toBe(true);
    expect(isWithinBookingWindow(plus(181 * 24 * 60), now)).toBe(false);
  });

  it("equipe: pode encaixar em cima da hora, mas não além de 1 ano", () => {
    expect(isWithinStaffBookingHorizon(plus(1), now)).toBe(true);
    expect(isWithinStaffBookingHorizon(plus(365 * 24 * 60), now)).toBe(true);
    expect(isWithinStaffBookingHorizon(plus(366 * 24 * 60), now)).toBe(false);
  });
});
