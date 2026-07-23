import { beforeEach, describe, expect, it, vi } from "vitest";

import prismaModule from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/prisma", () => ({
  default: {
    rateLimit: {
      upsert: vi.fn(),
    },
  },
}));

const prisma = prismaModule as unknown as {
  rateLimit: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite requisição dentro do limite", async () => {
    prisma.rateLimit.upsert.mockResolvedValueOnce({
      count: 1,
      id: "rl-1",
      key: "key",
      windowStart: new Date(),
      resetAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await rateLimit({ key: "ip:1", limit: 5, windowMs: 60_000 });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("bloqueia requisição que excede o limite", async () => {
    prisma.rateLimit.upsert.mockResolvedValueOnce({
      count: 6,
      id: "rl-1",
      key: "key",
      windowStart: new Date(),
      resetAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await rateLimit({ key: "ip:1", limit: 5, windowMs: 60_000 });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("usa janela fixa baseada no windowMs", async () => {
    prisma.rateLimit.upsert.mockResolvedValueOnce({
      count: 1,
      id: "rl-1",
      key: "key",
      windowStart: new Date(),
      resetAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const now = new Date("2026-07-23T10:30:45");
    await rateLimit({ key: "ip:1", limit: 5, windowMs: 60_000 }, now);

    expect(prisma.rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key_windowStart: {
            key: "ip:1",
            windowStart: new Date("2026-07-23T10:30:00"),
          },
        },
      }),
    );
  });
});
