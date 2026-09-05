import { describe, expect, it } from "vitest";

import { getNotificationChannels, getPlanPrice, SUBSCRIPTION_PLANS } from "@/config/subscription-plans";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";

describe("catálogo de planos", () => {
  it("mantém os preços publicados na landing", () => {
    expect(getPlanPrice(SubscriptionPlan.ESSENTIAL, BillingCycle.MONTHLY)).toBe(34.9);
    expect(getPlanPrice(SubscriptionPlan.ESSENTIAL, BillingCycle.ANNUAL)).toBe(335.04);
    expect(getPlanPrice(SubscriptionPlan.PROFESSIONAL, BillingCycle.MONTHLY)).toBe(49.99);
    expect(getPlanPrice(SubscriptionPlan.PROFESSIONAL, BillingCycle.ANNUAL)).toBe(479.9);
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.ENTERPRISE].monthlyPrice).toBe(97.9);
  });

  it("mantém SMS indisponível enquanto a integração não está ativa", () => {
    expect(getNotificationChannels(SubscriptionPlan.ESSENTIAL)).toEqual(["WHATSAPP", "EMAIL"]);
    expect(getNotificationChannels(SubscriptionPlan.PROFESSIONAL)).toEqual(["WHATSAPP", "EMAIL"]);
    expect(getNotificationChannels(SubscriptionPlan.ENTERPRISE)).toEqual(["WHATSAPP", "EMAIL"]);
  });

  it("mantém o plano Empresa como contratação comercial", () => {
    expect(SUBSCRIPTION_PLANS[SubscriptionPlan.ENTERPRISE].selfServiceCheckout).toBe(false);
  });
});
