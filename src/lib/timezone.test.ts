import { describe, expect, it } from "vitest";

import { formatClinicDateTimeInput, getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";

describe("parseClinicDateTime", () => {
  it("converte data/hora no fuso da loja para UTC", () => {
    const result = parseClinicDateTime("2026-07-20T10:00", "America/Sao_Paulo");

    expect(result).toBeInstanceOf(Date);
    // 10:00 em São Paulo (UTC-3 no horário de inverno/verão dependendo da data)
    // deve estar entre 12:00 e 14:00 UTC.
    expect(result?.getUTCHours()).toBeGreaterThanOrEqual(12);
    expect(result?.getUTCHours()).toBeLessThanOrEqual(14);
  });

  it("retorna null para formato inválido", () => {
    expect(parseClinicDateTime("20/07/2026 10:00", "America/Sao_Paulo")).toBeNull();
  });

  it("retorna null para data inexistente", () => {
    expect(parseClinicDateTime("2026-02-30T10:00", "America/Sao_Paulo")).toBeNull();
  });

  it("retorna null para hora inválida", () => {
    expect(parseClinicDateTime("2026-07-20T25:00", "America/Sao_Paulo")).toBeNull();
  });
});

describe("formatClinicDateTimeInput", () => {
  it("formata data UTC no fuso da loja", () => {
    const date = new Date("2026-07-20T13:00:00.000Z");
    const formatted = formatClinicDateTimeInput(date, "America/Sao_Paulo");

    expect(formatted).toMatch(/^2026-07-20T\d{2}:\d{2}$/);
  });
});

describe("getClinicDateBounds", () => {
  it("retorna limites corretos para um dia específico", () => {
    const now = new Date("2026-07-20T15:30:00.000Z");
    const bounds = getClinicDateBounds("America/Sao_Paulo", now);

    expect(bounds.startOfToday.getTime()).toBeLessThan(now.getTime());
    expect(bounds.startOfTomorrow.getTime()).toBeGreaterThan(bounds.startOfToday.getTime());
    expect(bounds.startOfMonth.getTime()).toBeLessThanOrEqual(bounds.startOfToday.getTime());
    expect(bounds.startOfNextMonth.getTime()).toBeGreaterThan(bounds.startOfMonth.getTime());
    expect(bounds.startOfPreviousMonth.getTime()).toBeLessThan(bounds.startOfMonth.getTime());
  });

  it("startOfToday representa meia-noite no fuso informado", () => {
    const now = new Date("2026-07-20T15:30:00.000Z");
    const bounds = getClinicDateBounds("America/Sao_Paulo", now);
    const localStart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).format(bounds.startOfToday);

    expect(localStart).toMatch(/00:00:00/);
  });
});

describe("datas sem horário", () => {
  it("grava o dia escolhido ao meio-dia da loja (mesmo dia em UTC)", async () => {
    const { parseClinicDateOnly } = await import("./timezone");
    expect(parseClinicDateOnly("2026-10-01", "America/Sao_Paulo")?.toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(parseClinicDateOnly("2026-02-30", "America/Sao_Paulo")).toBeNull();
    expect(parseClinicDateOnly("01/10/2026", "America/Sao_Paulo")).toBeNull();
  });
});
