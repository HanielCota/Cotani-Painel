import { ClinicOperationalStatus } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

export const CLINIC_SUSPENDED_MESSAGE = "Esta loja está temporariamente suspensa pela Cotani.";

export function isClinicOperational(
  clinic: Pick<ClinicModel, "operationalStatus" | "deletedAt">,
): boolean {
  return clinic.operationalStatus === ClinicOperationalStatus.ACTIVE && clinic.deletedAt === null;
}
