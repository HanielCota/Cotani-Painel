import { describe, expect, it } from "vitest";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import {
  isSubscriptionActive,
  requireActiveSubscription,
  SUBSCRIPTION_INACTIVE_MESSAGE,
} from "@/server/subscription";

describe("isSubscriptionActive", () => {
  it("bloqueia unidade que reteve status ativo após downgrade", () => {
    expect(isSubscriptionActive({ subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01"), billingOwnerId: "owner", subscriptionPlan: "PROFESSIONAL" })).toBe(false);
  });
  it("não aceita vigência em cache da unidade se o titular venceu", () => {
    expect(isSubscriptionActive({ subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01"), billingOwnerId: "owner", subscriptionPlan: "ENTERPRISE",
      billingOwner: { subscriptionStatus: "INACTIVE", subscriptionPlan: "ENTERPRISE", operationalStatus: "ACTIVE" } })).toBe(false);
  });
  it("bloqueia exatamente no instante do vencimento", () => {
    const now = new Date();
    expect(isSubscriptionActive({ subscriptionStatus: "ACTIVE", subscriptionExpiresAt: now }, now)).toBe(false);
  });
  it("retorna true quando status é ACTIVE", () => {
    expect(isSubscriptionActive({
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: new Date(Date.now() + 86_400_000),
    })).toBe(true);
  });

  it("retorna true durante o período grátis", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    expect(isSubscriptionActive({
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date("2026-08-26T12:00:00.000Z"),
    }, now)).toBe(true);
  });

  it("retorna false quando o período grátis venceu", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    expect(isSubscriptionActive({
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date("2026-08-24T12:00:00.000Z"),
    }, now)).toBe(false);
  });

  it("retorna false para INACTIVE", () => {
    expect(isSubscriptionActive({ subscriptionStatus: SubscriptionStatus.INACTIVE })).toBe(false);
  });

  it("retorna false para PAST_DUE", () => {
    expect(isSubscriptionActive({ subscriptionStatus: SubscriptionStatus.PAST_DUE })).toBe(false);
  });

  it("retorna false para CANCELED", () => {
    expect(isSubscriptionActive({ subscriptionStatus: SubscriptionStatus.CANCELED })).toBe(false);
  });
});

describe("requireActiveSubscription", () => {
  it("retorna a clínica quando ativa", () => {
    const clinic = {
      id: "1",
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: new Date(Date.now() + 86_400_000),
    };

    expect(requireActiveSubscription(clinic)).toBe(clinic);
  });

  it("lança erro quando a assinatura não está ativa", () => {
    const clinic = { id: "1", subscriptionStatus: SubscriptionStatus.INACTIVE };

    expect(() => requireActiveSubscription(clinic)).toThrow(SUBSCRIPTION_INACTIVE_MESSAGE);
  });
});
