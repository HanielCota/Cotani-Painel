import { describe, expect, it } from "vitest";

import { buildAppointmentsCsv } from "@/server/services/reports-export";

describe("buildAppointmentsCsv", () => {
  it("gera CSV em português compatível com Excel", () => {
    const csv = buildAppointmentsCsv([{
      id: "appointment-1",
      customerName: "João, da Silva",
      serviceName: "Corte",
      professionalName: "Maria",
      startTime: "2026-08-26T15:00:00.000Z",
      status: "CONFIRMED",
      servicePrice: 49.9,
    }], "America/Sao_Paulo");

    expect(csv).toContain('"Data e horário";"Cliente"');
    expect(csv).toContain('"João, da Silva"');
    expect(csv).toContain('"Confirmado"');
    expect(csv).toContain('"49,90"');
  });

  it("neutraliza células que poderiam executar fórmulas", () => {
    const csv = buildAppointmentsCsv([{
      id: "appointment-1",
      customerName: "=HYPERLINK(\"https://example.com\")",
      serviceName: "Corte",
      professionalName: null,
      startTime: "2026-08-26T15:00:00.000Z",
      status: "PENDING",
      servicePrice: 10,
    }], "America/Sao_Paulo");

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
  });
});
