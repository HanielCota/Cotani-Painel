CREATE TYPE "OperationalCategory" AS ENUM ('JOB', 'WEBHOOK');
CREATE TYPE "OperationalStatus" AS ENUM ('SUCCESS', 'WARNING', 'FAILURE');

CREATE TABLE "OperationalEvent" (
  "id" TEXT NOT NULL,
  "category" "OperationalCategory" NOT NULL,
  "operation" TEXT NOT NULL,
  "status" "OperationalStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "summary" JSONB,
  "error" TEXT,
  "externalEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalEvent_category_startedAt_idx" ON "OperationalEvent"("category", "startedAt");
CREATE INDEX "OperationalEvent_status_startedAt_idx" ON "OperationalEvent"("status", "startedAt");
CREATE INDEX "OperationalEvent_operation_startedAt_idx" ON "OperationalEvent"("operation", "startedAt");

ALTER TABLE "OperationalEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OperationalEvent_backend_access" ON "OperationalEvent"
  FOR ALL TO cotani_backend USING (true) WITH CHECK (true);
REVOKE ALL PRIVILEGES ON TABLE "OperationalEvent" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OperationalEvent" TO cotani_backend;
