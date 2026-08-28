ALTER TABLE "Clinic"
ADD COLUMN "mercadoPagoCheckoutUrl" TEXT,
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Impede que assinaturas legadas permaneçam ativas indefinidamente sem data.
UPDATE "Clinic"
SET "subscriptionExpiresAt" = CASE
  WHEN "subscriptionCycle" = 'ANNUAL' THEN COALESCE("updatedAt", NOW()) + INTERVAL '1 year'
  ELSE COALESCE("updatedAt", NOW()) + INTERVAL '1 month'
END
WHERE "subscriptionStatus" = 'ACTIVE' AND "subscriptionExpiresAt" IS NULL;
