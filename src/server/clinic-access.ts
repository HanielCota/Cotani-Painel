import "server-only";

import { ClinicOperationalStatus } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

export const CLINIC_SUSPENDED_MESSAGE = "Este negócio está temporariamente suspenso pela Cotani.";

export function isClinicOperational(
  clinic: Pick<ClinicModel, "operationalStatus" | "deletedAt">,
): boolean {
  return clinic.operationalStatus === ClinicOperationalStatus.ACTIVE && clinic.deletedAt === null;
}
