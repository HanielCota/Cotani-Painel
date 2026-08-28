-- A assinatura agora separa o nível do produto (plano) do período de cobrança.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING' BEFORE 'ACTIVE';

CREATE TYPE "SubscriptionPlan_new" AS ENUM ('ESSENTIAL', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

ALTER TABLE "Clinic"
  ADD COLUMN "subscriptionPlan_new" "SubscriptionPlan_new",
  ADD COLUMN "subscriptionCycle" "BillingCycle",
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "mercadoPagoCheckoutKey" TEXT,
  ADD COLUMN "mercadoPagoCheckoutStartedAt" TIMESTAMP(3);

UPDATE "Clinic"
SET
  "subscriptionPlan_new" = CASE
    WHEN "subscriptionPlan" IS NULL THEN NULL
    ELSE 'PROFESSIONAL'::"SubscriptionPlan_new"
  END,
  "subscriptionCycle" = CASE
    WHEN "subscriptionPlan"::text = 'ANNUAL' THEN 'ANNUAL'::"BillingCycle"
    WHEN "subscriptionPlan"::text = 'MONTHLY' THEN 'MONTHLY'::"BillingCycle"
    ELSE NULL
  END;

ALTER TABLE "PaymentHistory"
  ADD COLUMN "plan_new" "SubscriptionPlan_new",
  ADD COLUMN "billingCycle" "BillingCycle";

UPDATE "PaymentHistory"
SET
  "plan_new" = CASE
    WHEN "plan" IS NULL THEN NULL
    ELSE 'PROFESSIONAL'::"SubscriptionPlan_new"
  END,
  "billingCycle" = CASE
    WHEN "plan"::text = 'ANNUAL' THEN 'ANNUAL'::"BillingCycle"
    WHEN "plan"::text = 'MONTHLY' THEN 'MONTHLY'::"BillingCycle"
    ELSE NULL
  END;

ALTER TABLE "Clinic" DROP COLUMN "subscriptionPlan";
ALTER TABLE "PaymentHistory" DROP COLUMN "plan";
DROP TYPE "SubscriptionPlan";

ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
ALTER TABLE "Clinic" RENAME COLUMN "subscriptionPlan_new" TO "subscriptionPlan";
ALTER TABLE "PaymentHistory" RENAME COLUMN "plan_new" TO "plan";
