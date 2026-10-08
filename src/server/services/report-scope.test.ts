import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import type { TenantContext } from "@/server/tenant";
import { getAuthorizedReportClinicIds } from "@/server/services/report-scope";

function context(role: TenantContext["role"], clinicId: string, billingOwnerId: string | null): TenantContext {
  return {
    clinic: { id: clinicId, billingOwnerId, subscriptionPlan: "ENTERPRISE" },
    membership: { userId: "user-1" },
    role,
  } as TenantContext;
}

describe("authorized report scope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("limits a secondary-unit administrator without owner access to their own unit", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);

    await expect(getAuthorizedReportClinicIds(context("ADMIN", "unit-1", "owner"))).resolves.toEqual(["unit-1"]);
    expect(prismaMock.clinic.findMany).not.toHaveBeenCalled();
  });

  it("limits non-administrators to their selected unit", async () => {
    await expect(getAuthorizedReportClinicIds(context("RECEPTIONIST", "unit-1", "owner"))).resolves.toEqual(["unit-1"]);
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
  });

  it("allows an owner administrator to consolidate active units", async () => {
    prismaMock.clinic.findMany.mockResolvedValueOnce([{ id: "owner" }, { id: "unit-1" }]);

    await expect(getAuthorizedReportClinicIds(context("ADMIN", "owner", null))).resolves.toEqual(["owner", "unit-1"]);
    expect(prismaMock.clinic.findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "owner" }, { billingOwnerId: "owner" }], deletedAt: null },
      select: { id: true },
    });
  });

  it("allows a secondary-unit administrator who is also an owner administrator", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce({ role: "ADMIN" });
    prismaMock.clinic.findMany.mockResolvedValueOnce([{ id: "owner" }, { id: "unit-1" }]);

    await expect(getAuthorizedReportClinicIds(context("ADMIN", "unit-1", "owner"))).resolves.toEqual(["owner", "unit-1"]);
  });
});
