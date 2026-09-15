ALTER TABLE "BillingContract"
ADD COLUMN "checkoutSource" TEXT,
ADD COLUMN "checkoutEmail" TEXT,
ADD COLUMN "checkoutName" TEXT,
ADD COLUMN "activationStartedAt" TIMESTAMP(3),
ADD COLUMN "activationSentAt" TIMESTAMP(3),
ADD COLUMN "activationError" TEXT;

CREATE INDEX "BillingContract_checkoutSource_checkoutEmail_createdAt_idx"
ON "BillingContract"("checkoutSource", "checkoutEmail", "createdAt");
