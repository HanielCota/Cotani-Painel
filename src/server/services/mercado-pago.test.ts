import { describe, expect, it } from "vitest";
import { normalizeSubscriptionStatus, subscriptionPeriodEnd } from "./mercado-pago";
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
