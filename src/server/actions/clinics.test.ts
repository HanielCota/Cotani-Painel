import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
  appointment: { count: vi.fn() },
  clinic: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  membership: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/server/services/action-rate-limit", () => ({ allowClinicInvitation: vi.fn() }));
vi.mock("@/server/auth", () => ({ ensureCurrentAppUser: vi.fn() }));
vi.mock("@/server/tenant", () => ({
  ACTIVE_CLINIC_COOKIE: "cotani_active_clinic",
  getTenantContext: vi.fn(async () => ({
    clinic: { id: "owner", billingOwnerId: null },
    membership: { userId: "user-1" },
    role: "ADMIN",
  })),
  requireRole: (tenant: unknown) => tenant,
}));

const { toggleEnterpriseUnitArchive } = await import("@/server/actions/units");

const PLATFORM_SUSPENSION = { deletedAt: new Date("2026-10-01T00:00:00Z"), operationalStatus: "SUSPENDED", suspensionReason: "Pagamento contestado" };
const TENANT_ARCHIVE = { deletedAt: new Date("2026-10-01T00:00:00Z"), operationalStatus: "SUSPENDED", suspensionReason: "Arquivada pelo administrador da empresa" };

function owner(subscriptionPlan: string) {
  return { id: "owner", subscriptionPlan, pendingSubscriptionPlan: null, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00Z") };
}

function form() {
  const data = new FormData();
  data.set("unitId", "550e8400-e29b-41d4-a716-446655440010");
  return data;
}

describe("arquivar e reativar unidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.membership.findUnique.mockResolvedValue({ role: "ADMIN" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.clinic.updateMany.mockResolvedValue({ count: 1 });
  });

  it("não deixa o administrador da empresa desfazer uma suspensão da plataforma", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "unit-1", ...PLATFORM_SUSPENSION });

    const result = await toggleEnterpriseUnitArchive({ status: "idle" } as never, form());

    expect(result.status).toBe("error");
    expect(prismaMock.clinic.update).not.toHaveBeenCalled();
    expect(prismaMock.clinic.updateMany).not.toHaveBeenCalled();
  });

  it("recusa reativar unidade quando o plano não permite várias unidades", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "unit-1", ...TENANT_ARCHIVE });
    prismaMock.clinic.findUnique.mockResolvedValueOnce(owner("PROFESSIONAL"));

    const result = await toggleEnterpriseUnitArchive({ status: "idle" } as never, form());

    expect(result.status).toBe("error");
    expect(prismaMock.clinic.update).not.toHaveBeenCalled();
    expect(prismaMock.clinic.updateMany).not.toHaveBeenCalled();
  });

  it("reativa unidade arquivada pela empresa com plano Empresa ativo", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "unit-1", ...TENANT_ARCHIVE });
    prismaMock.clinic.findUnique.mockResolvedValueOnce(owner("ENTERPRISE"));

    const result = await toggleEnterpriseUnitArchive({ status: "idle" } as never, form());

    expect(result.status).toBe("success");
  });
});
