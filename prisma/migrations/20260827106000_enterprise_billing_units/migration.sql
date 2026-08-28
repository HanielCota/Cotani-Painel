ALTER TABLE "Clinic" ADD COLUMN "billingOwnerId" TEXT;

CREATE INDEX "Clinic_billingOwnerId_idx" ON "Clinic"("billingOwnerId");

ALTER TABLE "Clinic"
ADD CONSTRAINT "Clinic_billingOwnerId_fkey"
FOREIGN KEY ("billingOwnerId") REFERENCES "Clinic"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_billing_owner_not_self_check"
CHECK ("billingOwnerId" IS NULL OR "billingOwnerId" <> id);
