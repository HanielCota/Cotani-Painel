CREATE TYPE "ClinicOperationalStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "Clinic"
  ADD COLUMN "operationalStatus" "ClinicOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorClerkUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" TEXT,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "clinicId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorClerkUserId_createdAt_idx" ON "AdminAuditLog"("actorClerkUserId", "createdAt");
CREATE INDEX "AdminAuditLog_clinicId_createdAt_idx" ON "AdminAuditLog"("clinicId", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
