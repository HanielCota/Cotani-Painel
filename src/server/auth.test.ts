import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

describe("ensureCurrentAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("usa upsert para tornar a criação inicial idempotente", async () => {
    const authUser = {
      id: "7e915626-f082-4d68-8ca2-839604380d26",
      email: "pessoa@example.com",
      email_confirmed_at: "2026-08-27T12:00:00.000Z",
      user_metadata: { full_name: "Pessoa Teste" },
    };
    const appUser = {
      id: "app-user-1",
      authUserId: authUser.id,
      email: authUser.email,
      name: "Pessoa Teste",
    };
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(appUser),
      },
      clinicInvitation: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof transaction) => unknown) => callback(transaction));

    const { ensureCurrentAppUser } = await import("@/server/auth");
    await expect(ensureCurrentAppUser()).resolves.toEqual({ authUser, appUser });
    expect(transaction.user.upsert).toHaveBeenCalledWith({
      where: { authUserId: authUser.id },
      create: { authUserId: authUser.id, email: authUser.email, name: "Pessoa Teste" },
      update: { email: authUser.email, name: "Pessoa Teste" },
    });
  });
});
