import { afterEach, describe, expect, it } from "vitest";

import { isTypingTarget, NEW_APPOINTMENT_EVENT, normalizeSearch, requestNewAppointment } from "@/lib/shortcuts";

describe("atalhos", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("requestNewAppointment só é atendido se algo na página escuta", () => {
    expect(requestNewAppointment()).toBe(false);
    const listener = (event: Event) => event.preventDefault();
    window.addEventListener(NEW_APPOINTMENT_EVENT, listener);
    expect(requestNewAppointment()).toBe(true);
    window.removeEventListener(NEW_APPOINTMENT_EVENT, listener);
  });

  it("não dispara atalho de uma tecla dentro de campos", () => {
    document.body.innerHTML = `<input id="a" /><textarea id="b"></textarea><div id="c" contenteditable="true"></div><button id="d"></button>`;
    expect(isTypingTarget(document.getElementById("a"))).toBe(true);
    expect(isTypingTarget(document.getElementById("b"))).toBe(true);
    expect(isTypingTarget(document.getElementById("d"))).toBe(false);
  });

  it("busca ignora acentos e caixa", () => {
    expect(normalizeSearch("  Relatórios ")).toBe("relatorios");
    expect(normalizeSearch("Configurações").includes(normalizeSearch("configuracoes"))).toBe(true);
  });
});
