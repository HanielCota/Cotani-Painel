-- Canonicaliza telefones brasileiros antes de a aplicação passar a persistir
-- o DDI 55. Se existirem cadastros duplicados nos dois formatos, preserva o
-- mais antigo e move seu histórico para ele.
CREATE TEMP TABLE "_CustomerPhoneMerge" ON COMMIT DROP AS
WITH normalized AS (
  SELECT
    "id",
    "clinicId",
    "createdAt",
    CASE
      WHEN length(regexp_replace("phone", '\D', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace("phone", '\D', '', 'g')
      ELSE regexp_replace("phone", '\D', '', 'g')
    END AS canonical_phone
  FROM "Customer"
), ranked AS (
  SELECT *, first_value("id") OVER (
    PARTITION BY "clinicId", canonical_phone ORDER BY "createdAt", "id"
  ) AS keeper_id
  FROM normalized
)
SELECT "id" AS duplicate_id, keeper_id, canonical_phone
FROM ranked;

UPDATE "Appointment" AS appointment
SET "customerId" = merge.keeper_id
FROM "_CustomerPhoneMerge" AS merge
WHERE appointment."customerId" = merge.duplicate_id
  AND merge.duplicate_id <> merge.keeper_id;

DELETE FROM "Customer" AS customer
USING "_CustomerPhoneMerge" AS merge
WHERE customer."id" = merge.duplicate_id
  AND merge.duplicate_id <> merge.keeper_id;

UPDATE "Customer" AS customer
SET "phone" = merge.canonical_phone
FROM "_CustomerPhoneMerge" AS merge
WHERE customer."id" = merge.keeper_id;

-- Snapshot financeiro do atendimento: alterações futuras no cadastro do
-- serviço não podem reescrever o histórico de receita.
ALTER TABLE "Appointment"
  ADD COLUMN "priceAtBooking" DECIMAL(10,2),
  ADD COLUMN "totalPrice" DECIMAL(10,2),
  ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "Appointment" AS appointment
SET
  "priceAtBooking" = service."price",
  "totalPrice" = service."price"
FROM "Service" AS service
WHERE service."id" = appointment."serviceId";

ALTER TABLE "Appointment"
  ALTER COLUMN "priceAtBooking" SET NOT NULL,
  ALTER COLUMN "totalPrice" SET NOT NULL,
  ADD CONSTRAINT "Appointment_priceAtBooking_nonnegative" CHECK ("priceAtBooking" >= 0),
  ADD CONSTRAINT "Appointment_totalPrice_nonnegative" CHECK ("totalPrice" >= 0);

-- Quando há profissional, ele é o recurso exclusivo. Atendimentos ainda não
-- atribuídos preservam o comportamento legado de uma capacidade por serviço.
ALTER TABLE "Appointment"
  DROP CONSTRAINT "Appointment_service_no_overlap";

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_professional_no_overlap"
    EXCLUDE USING GIST (
      "professionalId" WITH =,
      tsrange("startTime", "endTime", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELED' AND "professionalId" IS NOT NULL),
  ADD CONSTRAINT "Appointment_unassigned_service_no_overlap"
    EXCLUDE USING GIST (
      "serviceId" WITH =,
      tsrange("startTime", "endTime", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELED' AND "professionalId" IS NULL);

-- Permite limitar o papel PROVIDER à agenda do profissional correspondente.
ALTER TABLE "Professional" ADD COLUMN "membershipId" TEXT;
CREATE UNIQUE INDEX "Professional_membershipId_key" ON "Professional"("membershipId");
ALTER TABLE "Professional"
  ADD CONSTRAINT "Professional_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Uma cobrança real do Mercado Pago só pode aparecer uma vez no histórico.
CREATE UNIQUE INDEX "PaymentHistory_mercadoPagoPaymentId_key"
  ON "PaymentHistory"("mercadoPagoPaymentId");
