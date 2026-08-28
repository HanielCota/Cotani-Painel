-- The application accesses these tables only through the trusted Prisma backend.
-- Enabling RLS without public policies prevents the Data API publishable key from
-- reading or mutating tenant data. The database owner used by Prisma bypasses RLS.
ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClinicInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Professional" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
