-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'OTHER');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'OTHER';
