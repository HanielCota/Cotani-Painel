import { describe, expect, it } from "vitest";

import { generateIcsContent, parseLocalDateTime } from "@/components/public/success-actions";

describe("ações do comprovante público", () => {
  it("rejeita datas normalizadas pelo JavaScript e horários inválidos", () => {
    expect(parseLocalDateTime("2026-02-31", "10:00", "America/Sao_Paulo")).toBeNull();
    expect(parseLocalDateTime("2026-08-31", "25:00", "America/Sao_Paulo")).toBeNull();
    expect(parseLocalDateTime("texto", "10:00", "America/Sao_Paulo")).toBeNull();
  });

  it("neutraliza quebra de linha e metacaracteres em arquivos ICS", () => {
    const content = generateIcsContent({
      title: "Serviço\r\nBEGIN:VEVENT",
      start: new Date("2026-08-31T13:00:00.000Z"),
      end: new Date("2026-08-31T14:00:00.000Z"),
      description: "Linha 1\nLinha 2; teste, ok",
      location: "Loja, Centro",
    });

    expect(content).toContain("SUMMARY:Serviço\\nBEGIN:VEVENT");
    expect(content).not.toContain("SUMMARY:Serviço\r\nBEGIN:VEVENT");
    expect(content).toContain("DESCRIPTION:Linha 1\\nLinha 2\\; teste\\, ok");
    expect(content).toContain("DTSTART:20260831T130000Z");
  });
});
