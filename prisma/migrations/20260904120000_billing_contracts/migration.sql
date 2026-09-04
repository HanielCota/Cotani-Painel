CREATE TABLE "BillingContract" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "cycle" "BillingCycle" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "remotePlanId" TEXT NOT NULL,
  "remoteId" TEXT,
  "checkoutUrl" TEXT,
  "state" TEXT NOT NULL DEFAULT 'CREATING',
  "lastReconciledAt" TIMESTAMP(3),
  "reconciliationOffset" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingContract_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BillingContract_remoteId_key" ON "BillingContract"("remoteId");
CREATE INDEX "BillingContract_clinicId_createdAt_idx" ON "BillingContract"("clinicId", "createdAt");
CREATE INDEX "BillingContract_lastReconciledAt_idx" ON "BillingContract"("lastReconciledAt");
ALTER TABLE "PaymentHistory" ADD COLUMN "periodEndsAt" TIMESTAMP(3), ADD COLUMN "mercadoPagoInvoiceId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "billingReconciledAt" TIMESTAMP(3);
ALTER TABLE "BillingContract" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "BillingContract" FROM anon, authenticated;
