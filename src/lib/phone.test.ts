import { describe, expect, it } from "vitest";

import { buildWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/phone";

describe("normalizeWhatsAppPhone", () => {
  it("adiciona 55 em número com 11 dígitos", () => {
    expect(normalizeWhatsAppPhone("11999999999")).toBe("5511999999999");
  });

  it("adiciona 55 em número com 10 dígitos", () => {
    expect(normalizeWhatsAppPhone("1133334444")).toBe("551133334444");
  });

  it("mantém número já internacional", () => {
    expect(normalizeWhatsAppPhone("5511999999999")).toBe("5511999999999");
  });

  it("ignora caracteres não numéricos", () => {
    expect(normalizeWhatsAppPhone("(11) 99999-9999")).toBe("5511999999999");
  });

  it("retorna null para número inválido", () => {
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });
});

describe("buildWhatsAppLink", () => {
  it("gera link wa.me codificado", () => {
    const link = buildWhatsAppLink("11999999999", "Olá, tudo bem?");
    expect(link).toBe("https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });

  it("retorna null para telefone inválido", () => {
    expect(buildWhatsAppLink("123", "Oi")).toBeNull();
  });
});
