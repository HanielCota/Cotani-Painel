import { describe, expect, it } from "vitest";

import { isActivePath } from "@/components/dashboard/app-sidebar";

function createSearchParams(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("isActivePath", () => {
  it("ativa no match exato sem query string", () => {
    expect(isActivePath("/dashboard/configuracoes", createSearchParams(""), "/dashboard/configuracoes")).toBe(true);
  });

  it("não ativa quando href não tem query mas URL atual tem", () => {
    expect(isActivePath("/dashboard/configuracoes", createSearchParams("tab=profissionais"), "/dashboard/configuracoes")).toBe(false);
  });

  it("ativa quando query string bate", () => {
    expect(isActivePath("/dashboard/configuracoes", createSearchParams("tab=profissionais"), "/dashboard/configuracoes?tab=profissionais")).toBe(true);
  });

  it("não ativa quando query string não bate", () => {
    expect(isActivePath("/dashboard/configuracoes", createSearchParams("tab=profissionais"), "/dashboard/configuracoes?tab=business-hours")).toBe(false);
  });

  it("ativa para sub-rotas", () => {
    expect(isActivePath("/dashboard/agenda/123", createSearchParams(""), "/dashboard/agenda")).toBe(true);
  });

  it("não ativa /dashboard para sub-rotas", () => {
    expect(isActivePath("/dashboard/agenda", createSearchParams(""), "/dashboard")).toBe(false);
  });

  it("ativa para serviços na aba services", () => {
    expect(isActivePath("/dashboard/configuracoes", createSearchParams("tab=services"), "/dashboard/configuracoes?tab=services")).toBe(true);
  });
});
