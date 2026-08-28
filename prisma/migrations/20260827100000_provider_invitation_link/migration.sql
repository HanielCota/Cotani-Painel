ALTER TABLE "ClinicInvitation" ADD COLUMN "professionalId" TEXT;

CREATE INDEX "ClinicInvitation_professionalId_idx" ON "ClinicInvitation"("professionalId");

ALTER TABLE "ClinicInvitation"
ADD CONSTRAINT "ClinicInvitation_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
