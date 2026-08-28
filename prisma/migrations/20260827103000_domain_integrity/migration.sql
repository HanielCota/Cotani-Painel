ALTER TABLE "User"
ADD CONSTRAINT "User_authUserId_fkey"
FOREIGN KEY ("authUserId") REFERENCES auth.users(id)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_maxAppointmentsPerDay_check"
CHECK ("maxAppointmentsPerDay" IS NULL OR "maxAppointmentsPerDay" > 0);

ALTER TABLE "Service" ADD CONSTRAINT "Service_duration_check" CHECK (duration > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_check" CHECK (price >= 0);

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_range_check" CHECK ("endTime" > "startTime");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_price_check" CHECK ("priceAtBooking" >= 0);

ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_day_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6);
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_time_format_check" CHECK (
  "openTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "closeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND ("breakStart" IS NULL OR "breakStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  AND ("breakEnd" IS NULL OR "breakEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_range_check" CHECK (
  NOT "isOpen" OR (
    "openTime" < "closeTime"
    AND (("breakStart" IS NULL AND "breakEnd" IS NULL) OR
      ("breakStart" IS NOT NULL AND "breakEnd" IS NOT NULL
       AND "openTime" <= "breakStart" AND "breakStart" < "breakEnd" AND "breakEnd" <= "closeTime"))
  )
);

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts_check"
CHECK (attempts >= 0 AND "maxAttempts" > 0 AND attempts <= "maxAttempts");

CREATE OR REPLACE FUNCTION enforce_appointment_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Customer" WHERE id = NEW."customerId" AND "clinicId" = NEW."clinicId") THEN
    RAISE EXCEPTION 'Appointment customer belongs to another clinic';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Service" WHERE id = NEW."serviceId" AND "clinicId" = NEW."clinicId") THEN
    RAISE EXCEPTION 'Appointment service belongs to another clinic';
  END IF;
  IF NEW."professionalId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Professional" WHERE id = NEW."professionalId" AND "clinicId" = NEW."clinicId") THEN
    RAISE EXCEPTION 'Appointment professional belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Appointment_tenant_guard" BEFORE INSERT OR UPDATE ON "Appointment"
FOR EACH ROW EXECUTE FUNCTION enforce_appointment_tenant();

CREATE OR REPLACE FUNCTION enforce_professional_service_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Professional" p JOIN "Service" s ON s.id = NEW."serviceId"
    WHERE p.id = NEW."professionalId" AND p."clinicId" = s."clinicId"
  ) THEN RAISE EXCEPTION 'Professional and service belong to different clinics'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalService_tenant_guard" BEFORE INSERT OR UPDATE ON "ProfessionalService"
FOR EACH ROW EXECUTE FUNCTION enforce_professional_service_tenant();

CREATE OR REPLACE FUNCTION enforce_professional_membership_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW."membershipId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Membership" m WHERE m.id = NEW."membershipId" AND m."clinicId" = NEW."clinicId" AND m.role = 'PROVIDER'
  ) THEN RAISE EXCEPTION 'Professional membership is invalid for this clinic or role'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Professional_membership_tenant_guard" BEFORE INSERT OR UPDATE ON "Professional"
FOR EACH ROW EXECUTE FUNCTION enforce_professional_membership_tenant();

CREATE OR REPLACE FUNCTION enforce_invitation_professional_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW."professionalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Professional" p WHERE p.id = NEW."professionalId" AND p."clinicId" = NEW."clinicId"
  ) THEN RAISE EXCEPTION 'Invitation professional belongs to another clinic'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClinicInvitation_professional_tenant_guard" BEFORE INSERT OR UPDATE ON "ClinicInvitation"
FOR EACH ROW EXECUTE FUNCTION enforce_invitation_professional_tenant();
