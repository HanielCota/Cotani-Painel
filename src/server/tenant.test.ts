import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  getSelectedOrgId,
  getTenantContext,
  InsufficientRoleError,
  requireActiveClinic,
  requireRole,
  TenantResolutionError,
} from "@/server/tenant";

vi.mock("@clerk/nextjs/server", () => {
  const protect = vi.fn();
  return {
    auth: Object.assign(vi.fn(() => ({ protect })), { protect }),
  };
});

const { auth } = await import("@clerk/nextjs/server");

describe("getTenantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lança erro quando não há orgId", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: null, userId: "user-1" });

    await expect(getTenantContext()).rejects.toThrow(TenantResolutionError);
  });

  it("lança erro quando vínculo não existe", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1", userId: "user-1" });
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);

    await expect(getTenantContext()).rejects.toThrow(TenantResolutionError);
  });

  it("retorna contexto quando vínculo existe", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1", userId: "user-1" });
    prismaMock.membership.findFirst.mockResolvedValueOnce({
      id: "memb-1",
      role: "ADMIN",
      clinicId: "clinic-1",
      userId: "user-1",
      clinic: { id: "clinic-1", name: "Barbearia" },
    });

    const ctx = await getTenantContext();

    expect(ctx.clinic.id).toBe("clinic-1");
    expect(ctx.role).toBe("ADMIN");
  });
});

describe("requireRole", () => {
  it("retorna contexto quando papel é permitido", () => {
    const ctx = {
      clinic: { id: "clinic-1" },
      membership: { id: "memb-1", role: "ADMIN" },
      role: "ADMIN" as const,
    };

    expect(requireRole(ctx, ["ADMIN"])).toBe(ctx);
  });

  it("lança erro quando papel não é permitido", () => {
    const ctx = {
      clinic: { id: "clinic-1" },
      membership: { id: "memb-1", role: "PROVIDER" },
      role: "PROVIDER" as const,
    };

    expect(() => requireRole(ctx, ["ADMIN"])).toThrow(InsufficientRoleError);
  });
});

describe("requireActiveClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null quando não há orgId", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: null });

    const result = await requireActiveClinic();

    expect(result).toBeNull();
  });

  it("retorna clínica quando orgId existe", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1" });
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1", name: "Barbearia" });

    const result = await requireActiveClinic();

    expect(result).toMatchObject({ id: "clinic-1" });
  });
});

describe("getSelectedOrgId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna orgId quando disponível", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1" });

    const result = await getSelectedOrgId();

    expect(result).toBe("org-1");
  });

  it("retorna null quando não há orgId", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: null });

    const result = await getSelectedOrgId();

    expect(result).toBeNull();
  });
});
