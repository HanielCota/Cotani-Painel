CREATE TYPE "FinancialEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED', 'CANCELED');

ALTER TABLE "Clinic"
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "User"
  ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "weeklySummary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Customer"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "nextReturnAt" TIMESTAMP(3);

CREATE TABLE "ClinicSlugAlias" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicSlugAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClinicSlugAlias_slug_key" ON "ClinicSlugAlias"("slug");
CREATE INDEX "ClinicSlugAlias_clinicId_idx" ON "ClinicSlugAlias"("clinicId");
ALTER TABLE "ClinicSlugAlias" ADD CONSTRAINT "ClinicSlugAlias_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProfessionalAvailability" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "isOpen" BOOLEAN NOT NULL DEFAULT true,
  "openTime" TEXT NOT NULL,
  "closeTime" TEXT NOT NULL,
  "breakStart" TEXT,
  "breakEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfessionalAvailability_professionalId_dayOfWeek_key" ON "ProfessionalAvailability"("professionalId", "dayOfWeek");
CREATE INDEX "ProfessionalAvailability_clinicId_idx" ON "ProfessionalAvailability"("clinicId");
ALTER TABLE "ProfessionalAvailability" ADD CONSTRAINT "ProfessionalAvailability_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalAvailability" ADD CONSTRAINT "ProfessionalAvailability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "type" "FinancialEntryType" NOT NULL,
  "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
  "description" TEXT NOT NULL,
  "category" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialEntry_clinicId_occurredAt_idx" ON "FinancialEntry"("clinicId", "occurredAt");
CREATE INDEX "FinancialEntry_clinicId_status_dueDate_idx" ON "FinancialEntry"("clinicId", "status", "dueDate");
CREATE INDEX "FinancialEntry_appointmentId_idx" ON "FinancialEntry"("appointmentId");
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
