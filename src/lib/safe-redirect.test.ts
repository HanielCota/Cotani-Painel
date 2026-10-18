import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("mantém caminhos internos, com query e hash", () => {
    expect(safeRedirectPath("/dashboard/agenda")).toBe("/dashboard/agenda");
    expect(safeRedirectPath("/dashboard/agenda?visao=semana#hoje")).toBe("/dashboard/agenda?visao=semana#hoje");
  });

  it.each([
    ["vazio", ""],
    ["nulo", null],
    ["indefinido", undefined],
    ["URL absoluta", "https://evil.example/dashboard"],
    ["protocolo relativo", "//evil.example"],
    ["barra invertida", "/\\evil.example"],
    ["barras invertidas", "\\\\evil.example"],
    ["barra invertida no meio", "/dashboard\\..\\evil"],
    ["tab", "/\t/evil.example"],
    ["quebra de linha", "/\n/evil.example"],
    ["javascript", "javascript:alert(1)"],
    ["sem barra inicial", "dashboard"],
  ])("recusa %s e volta para o painel", (_caso, value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("usa o destino padrão informado", () => {
    expect(safeRedirectPath("//evil.example", "/admin")).toBe("/admin");
  });

  it("caminho codificado continua interno", () => {
    expect(safeRedirectPath("/%5Cevil.example")).toBe("/%5Cevil.example");
  });
});
