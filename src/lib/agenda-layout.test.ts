import { describe, expect, it } from "vitest";

import { gridBounds, layoutColumn, localDateAndMinutes } from "./agenda-layout";
import { addDaysToDateKey, startOfWeekDateKey, weekdayOfDateKey } from "./timezone";

const tz = "America/Sao_Paulo";
// 2026-10-20 é terça; 12:00Z = 09:00 em São Paulo.
const at = (hhmm: string) => new Date(`2026-10-20T${hhmm}:00-03:00`).toISOString();
const item = (id: string, start: string, end: string) => ({ id, startTime: at(start), endTime: at(end) });

describe("datas de calendário", () => {
  it("soma dias, acha o dia da semana e a segunda-feira da semana", () => {
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(weekdayOfDateKey("2026-10-20")).toBe(2);
    expect(startOfWeekDateKey("2026-10-20")).toBe("2026-10-19");
    expect(startOfWeekDateKey("2026-10-25")).toBe("2026-10-19"); // domingo pertence à semana iniciada na segunda
  });
});

describe("localDateAndMinutes", () => {
  it("converte para data e minuto do dia no fuso do negócio", () => {
    expect(localDateAndMinutes(at("09:30"), tz)).toEqual({ dateKey: "2026-10-20", minutes: 570 });
  });
});

describe("gridBounds", () => {
  const hours = [
    { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
    { dayOfWeek: 6, isOpen: true, openTime: "08:30", closeTime: "13:00" },
    { dayOfWeek: 0, isOpen: false, openTime: "06:00", closeTime: "23:00" },
  ];

  it("usa o expediente dos dias exibidos, arredondado em horas cheias", () => {
    expect(gridBounds(hours, [2], [])).toEqual({ start: 540, end: 1080 });
    expect(gridBounds(hours, [2, 6], [])).toEqual({ start: 480, end: 1080 });
  });

  it("ignora dias fechados, amplia para atendimentos fora do expediente e tem padrão", () => {
    expect(gridBounds(hours, [0], [])).toEqual({ start: 480, end: 1080 });
    expect(gridBounds(hours, [2], [{ start: 1110, end: 1170 }])).toEqual({ start: 540, end: 1200 });
  });
});

describe("layoutColumn", () => {
  it("posiciona em minutos a partir do início da grade", () => {
    const [positioned] = layoutColumn([item("a", "10:00", "10:30")], tz, 540, 1080);
    expect(positioned).toMatchObject({ top: 60, height: 30, lane: 0, lanes: 1 });
  });

  it("divide em faixas só o que se sobrepõe", () => {
    const result = layoutColumn([
      item("a", "09:00", "10:00"),
      item("b", "09:30", "10:30"),
      item("c", "10:00", "11:00"),
      item("d", "12:00", "12:30"),
    ], tz, 540, 1080);
    const byId = Object.fromEntries(result.map((entry) => [entry.item.id, entry]));
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.c).toMatchObject({ lane: 0, lanes: 2 }); // reaproveita a faixa de "a", que já acabou
    expect(byId.d).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("garante altura mínima para atendimentos curtos", () => {
    const [positioned] = layoutColumn([item("a", "10:00", "10:05")], tz, 540, 1080);
    expect(positioned.height).toBe(15);
  });
});
