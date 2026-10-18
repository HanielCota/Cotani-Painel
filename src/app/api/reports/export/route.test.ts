import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  clinic: { findMany: vi.fn() },
  membership: { findFirst: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/tenant", () => ({ getApiTenant: vi.fn() }));
vi.mock("@/lib/api-rate-limit", () => ({ checkApiRateLimit: vi.fn(async () => null) }));
vi.mock("@/server/subscription", () => ({ isSubscriptionActive: vi.fn(() => true) }));
vi.mock("@/server/services/reports", () => ({ getReportAppointmentsForExport: vi.fn(async () => []) }));

const { GET } = await import("@/app/api/reports/export/route");
const { getApiTenant } = await import("@/server/tenant");
const { getReportAppointmentsForExport } = await import("@/server/services/reports");

function tenantFor(clinicId: string, billingOwnerId: string | null) {
  return {
    ok: true as const,
    context: {
      clinic: { id: clinicId, billingOwnerId, subscriptionPlan: "ENTERPRISE", timeZone: "America/Sao_Paulo" },
      membership: { userId: "user-1" },
      role: "ADMIN" as const,
    },
  };
}

describe("exportação CSV de relatórios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.clinic.findMany.mockResolvedValue([{ id: "owner" }, { id: "unit-1" }]);
  });

  it("não inclui outras unidades para o administrador de uma unidade secundária", async () => {
    vi.mocked(getApiTenant).mockResolvedValue(tenantFor("unit-1", "owner") as never);
    prismaMock.membership.findFirst.mockResolvedValue(null);

    await GET(new NextRequest("https://painel.cotani.com.br/api/reports/export"));

    expect(getReportAppointmentsForExport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "unit-1" }),
      expect.objectContaining({ clinicIds: ["unit-1"] }),
    );
  });

  it("consolida as unidades para o administrador da loja principal", async () => {
    vi.mocked(getApiTenant).mockResolvedValue(tenantFor("owner", null) as never);

    await GET(new NextRequest("https://painel.cotani.com.br/api/reports/export"));

    expect(getReportAppointmentsForExport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "owner" }),
      expect.objectContaining({ clinicIds: ["owner", "unit-1"] }),
    );
  });
});
