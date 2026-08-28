import { describe, expect, it } from "vitest";

import {
  generateClinicSlug,
  mapSubscriptionStatus,
  slugify,
} from "@/server/services/clinic-provisioning";
import { SubscriptionStatus } from "@/generated/prisma/enums";

describe("slugify", () => {
  it("converte nome simples para slug", () => {
    expect(slugify("Barbearia do Zé")).toBe("barbearia-do-ze");
  });

  it("remove acentos e caracteres especiais", () => {
    expect(slugify("Cortes & Cia - São Paulo!!!")).toBe("cortes-cia-sao-paulo");
  });

  it("remove hifens no início e no fim", () => {
    expect(slugify("---Teste---")).toBe("teste");
  });

  it("converte para minúsculas", () => {
    expect(slugify("BARBEARIA TOP")).toBe("barbearia-top");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(slugify("")).toBe("");
  });
});

describe("generateClinicSlug", () => {
  it("gera slug composto por nome e sufixo único", () => {
    const slug = generateClinicSlug("Barbearia do Zé", "org_1234567890abcdef");

    expect(slug).toBe("barbearia-do-ze-abcdef");
  });

  it("gera slugs únicos para organizações diferentes com mesmo nome", () => {
    const slugA = generateClinicSlug("Barbearia Top", "org_aaaaaaaaaaaaaaaa");
    const slugB = generateClinicSlug("Barbearia Top", "org_bbbbbbbbbbbbbbbb");

    expect(slugA).not.toBe(slugB);
  });
});

describe("mapSubscriptionStatus", () => {
  it("mapeia active", () => {
    expect(mapSubscriptionStatus("active")).toBe(SubscriptionStatus.ACTIVE);
  });

  it("mapeia trialing", () => {
    expect(mapSubscriptionStatus("trialing")).toBe(SubscriptionStatus.TRIALING);
  });

  it("mapeia past_due", () => {
    expect(mapSubscriptionStatus("past_due")).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("mapeia canceled", () => {
    expect(mapSubscriptionStatus("canceled")).toBe(SubscriptionStatus.CANCELED);
  });

  it("retorna INACTIVE para valores desconhecidos", () => {
    expect(mapSubscriptionStatus("unknown")).toBe(SubscriptionStatus.INACTIVE);
  });

  it("retorna INACTIVE para valores não string", () => {
    expect(mapSubscriptionStatus(123)).toBe(SubscriptionStatus.INACTIVE);
  });
});
