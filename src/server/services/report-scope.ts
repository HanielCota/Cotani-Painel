import "server-only";

import { getPlanEntitlements } from "@/config/subscription-plans";
import prisma from "@/lib/prisma";
import type { TenantContext } from "@/server/tenant";

/** Only administrators of the billing owner may view consolidated unit reports. */
export async function getAuthorizedReportClinicIds(context: TenantContext): Promise<string[]> {
  const { clinic, membership, role } = context;
  if (role !== "ADMIN" || !getPlanEntitlements(clinic.subscriptionPlan).multipleLocations) {
    return [clinic.id];
  }

  const ownerId = clinic.billingOwnerId ?? clinic.id;
  if (ownerId !== clinic.id) {
    const ownerMembership = await prisma.membership.findFirst({
      where: { clinicId: ownerId, userId: membership.userId },
      select: { role: true },
    });
    if (ownerMembership?.role !== "ADMIN") return [clinic.id];
  }

  const units = await prisma.clinic.findMany({
    where: { OR: [{ id: ownerId }, { billingOwnerId: ownerId }], deletedAt: null },
    select: { id: true },
  });
  return units.map((unit) => unit.id);
}
