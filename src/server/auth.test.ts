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
    getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.clinicInvitation.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.upsert.mockResolvedValueOnce(appUser);

    const { ensureCurrentAppUser } = await import("@/server/auth");
    await expect(ensureCurrentAppUser()).resolves.toEqual({ authUser, appUser });
    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { authUserId: authUser.id },
      create: { authUserId: authUser.id, email: authUser.email, name: "Pessoa Teste" },
      update: { email: authUser.email, name: "Pessoa Teste" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("não abre transação para usuário já sincronizado sem convite pendente", async () => {
    const authUser = {
      id: "7e915626-f082-4d68-8ca2-839604380d26",
      email: "pessoa@example.com",
      email_confirmed_at: "2026-08-27T12:00:00.000Z",
      user_metadata: { full_name: "Pessoa Teste" },
    };
    const appUser = {
      id: "app-user-1",
      authUserId: authUser.id,
      legacyExternalUserId: null,
      email: authUser.email,
      name: "Pessoa Teste",
      createdAt: new Date(),
      updatedAt: new Date(),
      trialStartedAt: null,
    };

    getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    prismaMock.user.findUnique.mockResolvedValueOnce(appUser);
    prismaMock.clinicInvitation.findFirst.mockResolvedValueOnce(null);

    const { ensureCurrentAppUser } = await import("@/server/auth");
    await expect(ensureCurrentAppUser()).resolves.toEqual({ authUser, appUser });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
