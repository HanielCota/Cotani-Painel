ALTER TABLE "User" ADD COLUMN "trialStartedAt" TIMESTAMP(3);

UPDATE "User" AS u
SET "trialStartedAt" = first_clinic."startedAt"
FROM (
  SELECT m."userId", MIN(c."createdAt") AS "startedAt"
  FROM "Membership" m
  JOIN "Clinic" c ON c.id = m."clinicId"
  GROUP BY m."userId"
) AS first_clinic
WHERE first_clinic."userId" = u.id;
