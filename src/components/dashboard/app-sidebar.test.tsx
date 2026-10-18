import { describe, expect, it } from "vitest";

import { getVisibleNavigation, isActivePath } from "@/config/dashboard-navigation";

describe("isActivePath", () => {
  it("ativa no match exato e em sub-rotas", () => {
    expect(isActivePath("/dashboard/negocio/servicos", "/dashboard/negocio/servicos")).toBe(true);
    expect(isActivePath("/dashboard/clientes/123", "/dashboard/clientes")).toBe(true);
  });

  it("itens exatos não ativam em sub-rotas", () => {
    expect(isActivePath("/dashboard/agenda", "/dashboard", true)).toBe(false);
    expect(isActivePath("/dashboard/negocio/servicos", "/dashboard/negocio", true)).toBe(false);
  });

  it("não confunde prefixos parecidos", () => {
    expect(isActivePath("/dashboard/negocio/profissionais", "/dashboard/negocio/servicos")).toBe(false);
    expect(isActivePath("/dashboard/agendas", "/dashboard/agenda")).toBe(false);
  });
});

describe("getVisibleNavigation", () => {
  const titles = (role: Parameters<typeof getVisibleNavigation>[0], plan: Parameters<typeof getVisibleNavigation>[1]) =>
    getVisibleNavigation(role, plan).flatMap((section) => section.items.map((item) => item.title));

  it("profissional vê apenas a agenda e as configurações da conta", () => {
    expect(titles("PROVIDER", "PROFESSIONAL")).toEqual(["Agenda", "Configurações"]);
  });

  it("recepção não vê financeiro, relatórios nem cadastros do negócio", () => {
    const visible = titles("RECEPTIONIST", "ENTERPRISE");
    expect(visible).toContain("Clientes");
    expect(visible).not.toContain("Financeiro");
    expect(visible).not.toContain("Relatórios");
    expect(visible).not.toContain("Serviços");
  });

  it("relatórios dependem do plano", () => {
    expect(titles("ADMIN", "ESSENTIAL")).not.toContain("Relatórios");
    expect(titles("ADMIN", "PROFESSIONAL")).toContain("Relatórios");
  });
});
