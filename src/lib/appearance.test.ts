import { afterEach, describe, expect, it } from "vitest";

import { APPEARANCE_BOOT_SCRIPT, applyAppearance, resolveAccent } from "@/lib/appearance";

function runBootScript() {
  new Function(APPEARANCE_BOOT_SCRIPT)();
  return { ...document.documentElement.dataset };
}

describe("aparência", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.surface;
    delete document.documentElement.dataset.accent;
  });

  it("padrão: fundo neutro e destaque verde, sem atributos", () => {
    expect(runBootScript()).toEqual({});
  });

  it("aplica as escolhas salvas antes da pintura", () => {
    localStorage.setItem("cotani-surface", "azul");
    localStorage.setItem("cotani-accent", "laranja");
    expect(runBootScript()).toEqual({ surface: "azul", accent: "laranja" });
  });

  it("destaque automático segue o tema de fundo", () => {
    localStorage.setItem("cotani-surface", "ambar");
    localStorage.setItem("cotani-accent", "auto");
    expect(runBootScript()).toEqual({ surface: "ambar", accent: "laranja" });
    expect(resolveAccent("auto", "verde")).toBe("verde");
    expect(resolveAccent("auto", "neutro")).toBe("neutro");
  });

  it("ignora valores inválidos no armazenamento", () => {
    localStorage.setItem("cotani-surface", "<script>");
    localStorage.setItem("cotani-accent", "xyz");
    expect(runBootScript()).toEqual({});
  });

  it("applyAppearance remove os atributos ao voltar ao padrão", () => {
    applyAppearance("violeta", "rosa");
    expect(document.documentElement.dataset).toMatchObject({ surface: "violeta", accent: "rosa" });
    applyAppearance("neutro", "verde");
    expect(document.documentElement.dataset.surface).toBeUndefined();
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });
});
