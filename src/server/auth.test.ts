import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

const getUser = vi.fn();
const getClaims = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser, getClaims } })),
}));

describe("ensureCurrentAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "password" }] } }, error: null });
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

  it("vincula o cadastro legado, funde o duplicado e aceita o convite pendente", async () => {
    const authUser = {
      id: "7e915626-f082-4d68-8ca2-839604380d26",
      email: "Pessoa@Example.com",
      email_confirmed_at: "2026-08-27T12:00:00.000Z",
      user_metadata: { full_name: "Pessoa Teste" },
    };
    const canonicalUser = { id: "legacy-1", email: "pessoa@example.com", name: "Antigo", memberships: [] };
    const duplicateUser = {
      id: "legacy-2",
      email: "pessoa@example.com",
      name: "Duplicado",
      memberships: [{ id: "membership-old", clinicId: "clinic-1", role: "PROVIDER", professional: { id: "professional-1" } }],
    };
    const linkedUser = { id: "legacy-1", authUserId: authUser.id, email: "pessoa@example.com", name: "Pessoa Teste" };
    const invitation = {
      id: "invitation-1",
      clinicId: "clinic-2",
      role: "PROVIDER",
      professionalId: "professional-2",
    };
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([canonicalUser, duplicateUser]),
        update: vi.fn().mockResolvedValue(linkedUser),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      membership: {
        upsert: vi.fn()
          .mockResolvedValueOnce({ id: "membership-canonical" })
          .mockResolvedValueOnce({ id: "membership-invited" }),
        delete: vi.fn(),
      },
      professional: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: "professional-2" }),
        update: vi.fn(),
      },
      clinicInvitation: {
        findMany: vi.fn().mockResolvedValue([invitation]),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.clinicInvitation.findFirst.mockResolvedValueOnce({ id: "invitation-1" });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    );

    const { ensureCurrentAppUser } = await import("@/server/auth");
    await expect(ensureCurrentAppUser()).resolves.toEqual({ authUser, appUser: linkedUser });

    expect(transaction.professional.update).toHaveBeenCalledWith({
      where: { id: "professional-1" },
      data: { membershipId: "membership-canonical" },
    });
    expect(transaction.membership.delete).toHaveBeenCalledWith({ where: { id: "membership-old" } });
    expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: "legacy-2" } });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "legacy-1" },
      data: { authUserId: authUser.id, email: "pessoa@example.com", name: "Pessoa Teste" },
    });
    expect(transaction.professional.update).toHaveBeenCalledWith({
      where: { id: "professional-2" },
      data: { membershipId: "membership-invited" },
    });
    expect(transaction.clinicInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invitation-1" } }),
    );
    expect(transaction.clinicInvitation.updateMany).toHaveBeenCalledTimes(2);
  });

  it("não trata uma sessão de recuperação como login do painel", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "recovery" }] } }, error: null });
    const { getAuthenticatedUser } = await import("@/server/auth");

    await expect(getAuthenticatedUser()).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
