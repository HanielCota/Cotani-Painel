-- AddColumn
ALTER TABLE "Appointment" ADD COLUMN "cancellationToken" TEXT;

-- Backfill existing appointments with unique tokens
UPDATE "Appointment" SET "cancellationToken" = gen_random_uuid()::TEXT WHERE "cancellationToken" IS NULL;

-- AlterColumn to NOT NULL
ALTER TABLE "Appointment" ALTER COLUMN "cancellationToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_cancellationToken_key" ON "Appointment"("cancellationToken");
