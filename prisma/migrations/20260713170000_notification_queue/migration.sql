-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('CONFIRMATION', 'REMINDER_24H', 'REMINDER_2H');

-- AlterTable
-- Defaults temporários apenas para acomodar linhas legadas; removidos na sequência.
-- gen_random_uuid() é nativa do PostgreSQL 13+ e garante unicidade da chave de idempotência em linhas antigas.
ALTER TABLE "Notification"
    ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'CONFIRMATION',
    ADD COLUMN "recipient" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "lockedAt" TIMESTAMP(3),
    ADD COLUMN "error" TEXT;

ALTER TABLE "Notification"
    ALTER COLUMN "kind" DROP DEFAULT,
    ALTER COLUMN "recipient" DROP DEFAULT,
    ALTER COLUMN "idempotencyKey" DROP DEFAULT,
    ALTER COLUMN "nextAttemptAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");
