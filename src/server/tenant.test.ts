import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getClinicForRoles, getSelectedClinicId, getTenantContext, InsufficientRoleError, requireRole, TenantResolutionError } from "@/server/tenant";

vi.mock("@/server/auth", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  ensureCurrentAppUser: vi.fn().mockResolvedValue({ appUser: { id: "user-1" } }),
  requireMfaAssurance: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { cookies } = await import("next/headers");

const clinic = { id: "clinic-1", name: "Loja", operationalStatus: "ACTIVE", deletedAt: null };
const membership = { id: "membership-1", clinicId: clinic.id, userId: "user-1", role: "ADMIN", clinic };

describe("tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue({ value: clinic.id }) } as never);
  });

  it("resolve a loja apenas por um vínculo do usuário autenticado", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(membership as never);
    const result = await getTenantContext();
    expect(result.clinic).toEqual(clinic);
    expect(prismaMock.membership.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "user-1", clinicId: "clinic-1" }) }));
  });

  it("falha fechado quando não existe vínculo", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    await expect(getTenantContext()).rejects.toBeInstanceOf(TenantResolutionError);
  });

  it("não permite papel insuficiente", () => {
    expect(() => requireRole({ clinic, membership: { ...membership, role: "PROVIDER" }, role: "PROVIDER" } as never, ["ADMIN"]))
      .toThrow(InsufficientRoleError);
  });

  it("retorna null para acesso sem papel suficiente", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce({ ...membership, role: "PROVIDER" } as never);
    await expect(getClinicForRoles(["ADMIN"])).resolves.toBeNull();
  });

  it("lê a preferência de loja do cookie", async () => {
    await expect(getSelectedClinicId()).resolves.toBe("clinic-1");
  });
});
