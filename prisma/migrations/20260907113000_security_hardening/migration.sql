-- Keep extension-owned routines out of the Data API's default public schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  END IF;
END
$$;

-- Database-level financial invariants. Application validation remains the
-- friendly first line of defense; these constraints protect every writer.
ALTER TABLE public."FinancialEntry"
  ADD CONSTRAINT "FinancialEntry_amount_positive" CHECK (amount > 0),
  ADD CONSTRAINT "FinancialEntry_paidAmount_range" CHECK ("paidAmount" >= 0 AND "paidAmount" <= amount);

ALTER TABLE public."PaymentHistory"
  ADD CONSTRAINT "PaymentHistory_amount_nonnegative" CHECK (amount >= 0);

ALTER TABLE public."BillingContract"
  ADD CONSTRAINT "BillingContract_amount_nonnegative" CHECK (amount >= 0);

ALTER TABLE public."ProfessionalAvailability"
  ADD CONSTRAINT "ProfessionalAvailability_day_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  ADD CONSTRAINT "ProfessionalAvailability_time_format_check" CHECK (
    "openTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "closeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND ("breakStart" IS NULL OR "breakStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    AND ("breakEnd" IS NULL OR "breakEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  ),
  ADD CONSTRAINT "ProfessionalAvailability_range_check" CHECK (
    NOT "isOpen" OR (
      "openTime" < "closeTime"
      AND (("breakStart" IS NULL AND "breakEnd" IS NULL) OR
        ("breakStart" IS NOT NULL AND "breakEnd" IS NOT NULL
         AND "openTime" <= "breakStart" AND "breakStart" < "breakEnd" AND "breakEnd" <= "closeTime"))
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_appointment_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Customer" WHERE id = NEW."customerId" AND "clinicId" = NEW."clinicId") THEN
    RAISE EXCEPTION 'Appointment customer belongs to another clinic';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Service" WHERE id = NEW."serviceId" AND "clinicId" = NEW."clinicId") THEN
    RAISE EXCEPTION 'Appointment service belongs to another clinic';
  END IF;
  IF NEW."professionalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Professional" WHERE id = NEW."professionalId" AND "clinicId" = NEW."clinicId"
  ) THEN
    RAISE EXCEPTION 'Appointment professional belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_professional_service_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public."Professional" p
    JOIN public."Service" s ON s.id = NEW."serviceId"
    WHERE p.id = NEW."professionalId" AND p."clinicId" = s."clinicId"
  ) THEN
    RAISE EXCEPTION 'Professional and service belong to different clinics';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_professional_membership_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW."membershipId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Membership" m
    WHERE m.id = NEW."membershipId" AND m."clinicId" = NEW."clinicId" AND m.role = 'PROVIDER'
  ) THEN
    RAISE EXCEPTION 'Professional membership is invalid for this clinic or role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invitation_professional_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW."professionalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Professional" p
    WHERE p.id = NEW."professionalId" AND p."clinicId" = NEW."clinicId"
  ) THEN
    RAISE EXCEPTION 'Invitation professional belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_notification_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."Appointment" a
    WHERE a.id = NEW."appointmentId" AND a."clinicId" = NEW."clinicId"
  ) THEN
    RAISE EXCEPTION 'Notification appointment belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_availability_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."Professional" p
    WHERE p.id = NEW."professionalId" AND p."clinicId" = NEW."clinicId"
  ) THEN
    RAISE EXCEPTION 'Availability professional belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_financial_entry_tenant() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW."appointmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Appointment" a
    WHERE a.id = NEW."appointmentId" AND a."clinicId" = NEW."clinicId"
  ) THEN
    RAISE EXCEPTION 'Financial entry appointment belongs to another clinic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Notification_tenant_guard"
BEFORE INSERT OR UPDATE ON public."Notification"
FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_tenant();

CREATE TRIGGER "ProfessionalAvailability_tenant_guard"
BEFORE INSERT OR UPDATE ON public."ProfessionalAvailability"
FOR EACH ROW EXECUTE FUNCTION public.enforce_availability_tenant();

CREATE TRIGGER "FinancialEntry_tenant_guard"
BEFORE INSERT OR UPDATE ON public."FinancialEntry"
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_entry_tenant();

REVOKE ALL ON FUNCTION public.enforce_appointment_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_professional_service_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_professional_membership_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_invitation_professional_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_notification_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_availability_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_financial_entry_tenant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invoke_cotani_notification_job()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, net, vault
AS $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cotani_app_url' LIMIT 1) || '/api/jobs/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cotani_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
$$;
REVOKE ALL ON FUNCTION public.invoke_cotani_notification_job() FROM PUBLIC, anon, authenticated;

CREATE INDEX "ClinicInvitation_invitedByUserId_idx" ON public."ClinicInvitation"("invitedByUserId");
CREATE INDEX "Notification_appointmentId_idx" ON public."Notification"("appointmentId");
DROP INDEX public."PaymentHistory_mercadoPagoPaymentId_idx";
