CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Service"
  ADD CONSTRAINT "Service_duration_positive" CHECK ("duration" > 0),
  ADD CONSTRAINT "Service_price_nonnegative" CHECK ("price" >= 0);

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_end_after_start" CHECK ("endTime" > "startTime"),
  ADD CONSTRAINT "Appointment_customer_no_overlap"
    EXCLUDE USING GIST (
      "customerId" WITH =,
      tsrange("startTime", "endTime", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELED'),
  ADD CONSTRAINT "Appointment_service_no_overlap"
    EXCLUDE USING GIST (
      "serviceId" WITH =,
      tsrange("startTime", "endTime", '[)') WITH &&
    ) WHERE ("status" <> 'CANCELED');
