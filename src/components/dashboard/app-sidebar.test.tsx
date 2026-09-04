import { describe, expect, it } from "vitest";

import { isActivePath } from "@/components/dashboard/app-sidebar";

function createSearchParams(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("isActivePath", () => {
  it("ativa no match exato sem query string", () => {
    expect(isActivePath("/dashboard/negocio/servicos", createSearchParams(""), "/dashboard/negocio/servicos")).toBe(true);
  });

  it("não ativa quando href não tem query mas URL atual tem", () => {
    expect(isActivePath("/dashboard/negocio/servicos", createSearchParams("filtro=ativos"), "/dashboard/negocio/servicos")).toBe(false);
  });

  it("ativa quando query string bate", () => {
    expect(isActivePath("/dashboard/clientes", createSearchParams("page=2"), "/dashboard/clientes?page=2")).toBe(true);
  });

  it("não ativa quando query string não bate", () => {
    expect(isActivePath("/dashboard/clientes", createSearchParams("page=2"), "/dashboard/clientes?page=3")).toBe(false);
  });

  it("ativa para sub-rotas", () => {
    expect(isActivePath("/dashboard/agenda/123", createSearchParams(""), "/dashboard/agenda")).toBe(true);
  });

  it("não ativa /dashboard para sub-rotas", () => {
    expect(isActivePath("/dashboard/agenda", createSearchParams(""), "/dashboard", true)).toBe(false);
  });

  it("distingue páginas do negócio", () => {
    expect(isActivePath("/dashboard/negocio/profissionais", createSearchParams(""), "/dashboard/negocio/servicos")).toBe(false);
    expect(isActivePath("/dashboard/negocio/servicos", createSearchParams(""), "/dashboard/negocio", true)).toBe(false);
  });
});
