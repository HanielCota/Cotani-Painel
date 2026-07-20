import { describe, expect, it } from "vitest";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import {
  isSubscriptionActive,
  requireActiveSubscription,
  SUBSCRIPTION_INACTIVE_MESSAGE,
} from "@/server/subscription";

describe("isSubscriptionActive", () => {
  it("retorna true quando status é ACTIVE", () => {
    expect(isSubscriptionActive({ subscriptionStatus: SubscriptionStatus.ACTIVE })).toBe(true);
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
    const clinic = { id: "1", subscriptionStatus: SubscriptionStatus.ACTIVE };

    expect(requireActiveSubscription(clinic)).toBe(clinic);
  });

  it("lança erro quando a assinatura não está ativa", () => {
    const clinic = { id: "1", subscriptionStatus: SubscriptionStatus.INACTIVE };

    expect(() => requireActiveSubscription(clinic)).toThrow(SUBSCRIPTION_INACTIVE_MESSAGE);
  });
});
