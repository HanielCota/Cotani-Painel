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
    prisma.clinic.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 });

    const now = new Date("2026-07-23T10:00:00");
    const result = await expireSubscriptions(now);

    expect(result).toEqual({ pastDue: 2, expired: 1 });
    expect(prisma.clinic.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        subscriptionExpiresAt: { lt: now },
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        deletedAt: null,
      },
      data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
    });
  });

  it("não desativa assinaturas com data futura", async () => {
    prisma.clinic.updateMany.mockResolvedValue({ count: 0 });

    const result = await expireSubscriptions(new Date("2026-07-23T10:00:00"));

    expect(result.expired).toBe(0);
  });
});
