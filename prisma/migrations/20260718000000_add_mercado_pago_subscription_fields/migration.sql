-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "subscriptionPlan" "SubscriptionPlan";
ALTER TABLE "Clinic" ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "Clinic" ADD COLUMN     "mercadoPagoSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_mercadoPagoSubscriptionId_key" ON "Clinic"("mercadoPagoSubscriptionId");
