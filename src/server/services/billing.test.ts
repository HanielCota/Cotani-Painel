import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import prismaModule from "@/lib/prisma";
import { expireSubscriptions } from "@/server/services/billing";

vi.mock("@/lib/prisma", () => ({
  default: {
    clinic: {
      updateMany: vi.fn(),
    },
  },
}));

const prisma = prismaModule as unknown as {
  clinic: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

describe("expireSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica carência antes de desativar assinaturas", async () => {
    prisma.clinic.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const now = new Date("2026-07-23T10:00:00");
    const result = await expireSubscriptions(now);

    expect(result).toEqual({ trialsExpired: 0, pastDue: 2, expired: 1 });
    expect(prisma.clinic.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        subscriptionExpiresAt: { lt: now },
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        deletedAt: null,
      },
      data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
    });
  });

  it("encerra períodos grátis vencidos", async () => {
    prisma.clinic.updateMany
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    const now = new Date("2026-07-23T10:00:00");
    const result = await expireSubscriptions(now);
    expect(result.trialsExpired).toBe(3);
    expect(prisma.clinic.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        trialEndsAt: { lt: now },
        subscriptionStatus: SubscriptionStatus.TRIALING,
        hasPaidOnce: false,
        deletedAt: null,
      },
      data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
    });
  });

  it("não desativa assinaturas com data futura", async () => {
    prisma.clinic.updateMany.mockResolvedValue({ count: 0 });

    const result = await expireSubscriptions(new Date("2026-07-23T10:00:00"));

    expect(result.expired).toBe(0);
  });
});
