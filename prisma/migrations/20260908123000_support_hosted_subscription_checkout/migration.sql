-- Hosted Mercado Pago checkout starts as a planless pending subscription so
-- the buyer can securely enter the payment method on Mercado Pago's page.
ALTER TABLE "BillingContract" ALTER COLUMN "remotePlanId" DROP NOT NULL;
