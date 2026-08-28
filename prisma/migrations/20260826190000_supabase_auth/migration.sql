-- Preserve legacy authentication identifiers only for the one-time data migration.
ALTER TABLE "Clinic" RENAME COLUMN "clerkOrgId" TO "legacyExternalId";
ALTER INDEX "Clinic_clerkOrgId_key" RENAME TO "Clinic_legacyExternalId_key";
ALTER TABLE "Clinic" ALTER COLUMN "legacyExternalId" DROP NOT NULL;

ALTER TABLE "User" RENAME COLUMN "clerkUserId" TO "legacyExternalUserId";
ALTER INDEX "User_clerkUserId_key" RENAME TO "User_legacyExternalUserId_key";
ALTER TABLE "User" ALTER COLUMN "legacyExternalUserId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "authUserId" UUID;
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

ALTER TABLE "AdminAuditLog" RENAME COLUMN "actorClerkUserId" TO "actorAuthUserId";
ALTER INDEX "AdminAuditLog_actorClerkUserId_createdAt_idx"
  RENAME TO "AdminAuditLog_actorAuthUserId_createdAt_idx";

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "ClinicInvitation" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "ClinicRole" NOT NULL DEFAULT 'PROVIDER',
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedByUserId" TEXT NOT NULL,
  "authUserId" UUID,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicInvitation_email_status_idx" ON "ClinicInvitation"("email", "status");
CREATE INDEX "ClinicInvitation_clinicId_status_idx" ON "ClinicInvitation"("clinicId", "status");
CREATE INDEX "ClinicInvitation_authUserId_idx" ON "ClinicInvitation"("authUserId");

ALTER TABLE "ClinicInvitation"
  ADD CONSTRAINT "ClinicInvitation_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClinicInvitation"
  ADD CONSTRAINT "ClinicInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
