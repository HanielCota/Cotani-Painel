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

  it("desativa assinaturas expiradas ACTIVE", async () => {
    prisma.clinic.updateMany.mockResolvedValueOnce({ count: 2 });

    const now = new Date("2026-07-23T10:00:00");
    const result = await expireSubscriptions(now);

    expect(result.expired).toBe(2);
    expect(prisma.clinic.updateMany).toHaveBeenCalledWith({
      where: {
        subscriptionExpiresAt: { lt: now },
        subscriptionStatus: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        deletedAt: null,
      },
      data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
    });
  });

  it("não desativa assinaturas com data futura", async () => {
    prisma.clinic.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await expireSubscriptions(new Date("2026-07-23T10:00:00"));

    expect(result.expired).toBe(0);
  });
});
