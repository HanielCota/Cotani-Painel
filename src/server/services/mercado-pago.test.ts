import { describe, expect, it } from "vitest";
import { buildHostedSubscriptionBody, normalizeSubscriptionStatus, subscriptionPeriodEnd } from "./mercado-pago";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";

describe("checkout hospedado de assinatura", () => {
  it.each([
    [BillingCycle.MONTHLY, 1],
    [BillingCycle.ANNUAL, 12],
  ])("cria o ciclo %s sem exigir cartão no servidor", (cycle, frequency) => {
    const body = buildHostedSubscriptionBody({
      clinicId: "clinic-1",
      plan: SubscriptionPlan.PROFESSIONAL,
      cycle,
      idempotencyKey: "attempt-1",
      payerEmail: "cliente@cotani.com.br",
      backUrl: "https://painel.cotani.com.br/dashboard/assinatura",
    }, {
      id: SubscriptionPlan.PROFESSIONAL,
      cycle,
      name: `Profissional ${cycle}`,
      price: cycle === BillingCycle.MONTHLY ? 49.99 : 479.9,
      mercadoPagoPlanId: "legacy-plan",
    });

    expect(body).not.toHaveProperty("card_token_id");
    expect(body).not.toHaveProperty("preapproval_plan_id");
    expect(body).toMatchObject({
      status: "pending",
      external_reference: "clinic-1",
      auto_recurring: { frequency, frequency_type: "months", currency_id: "BRL" },
    });
  });
});

describe("período comprovado de cobrança", () => {
  it("authorized não significa pagamento", () => expect(normalizeSubscriptionStatus("authorized")).toBeNull());
  it("não deixa janeiro transbordar para março", () => {
    expect(subscriptionPeriodEnd("MONTHLY", undefined, new Date("2027-01-31T12:00:00Z")).toISOString()).toBe("2027-02-28T12:00:00.000Z");
  });
  it("limita aniversário anual de ano bissexto", () => {
    expect(subscriptionPeriodEnd("ANNUAL", undefined, new Date("2028-02-29T12:00:00Z")).toISOString()).toBe("2029-02-28T12:00:00.000Z");
  });
  it("não usa próxima cobrança para estender pagamento histórico", () => {
    expect(subscriptionPeriodEnd("MONTHLY", new Date("2099-01-01"), new Date("2026-01-01")).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});
