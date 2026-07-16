-- CreateTable
CREATE TABLE "BusinessHour" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHour_clinicId_dayOfWeek_key" ON "BusinessHour"("clinicId", "dayOfWeek");
CREATE INDEX "BusinessHour_clinicId_idx" ON "BusinessHour"("clinicId");

-- AddForeignKey
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default business hours for existing clinics (08:00-18:00, lunch 12:00-13:00, all days open)
INSERT INTO "BusinessHour" ("id", "clinicId", "dayOfWeek", "isOpen", "openTime", "closeTime", "breakStart", "breakEnd", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::TEXT,
    c.id AS "clinicId",
    d.day AS "dayOfWeek",
    true AS "isOpen",
    '08:00' AS "openTime",
    '18:00' AS "closeTime",
    '12:00' AS "breakStart",
    '13:00' AS "breakEnd",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "Clinic" c
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(day);
