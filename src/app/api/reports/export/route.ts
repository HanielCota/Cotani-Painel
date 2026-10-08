import { NextRequest, NextResponse } from "next/server";

import { getPlanEntitlements } from "@/config/subscription-plans";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { buildAppointmentsCsv } from "@/server/services/reports-export";
import { getReportAppointmentsForExport } from "@/server/services/reports";
import { isSubscriptionActive } from "@/server/subscription";
import { getApiTenant } from "@/server/tenant";
import { parseClinicDateTime } from "@/lib/timezone";
import { getAuthorizedReportClinicIds } from "@/server/services/report-scope";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "reports-export", 10, 60_000);
  if (rateLimitResponse) return rateLimitResponse;
  const { clinic } = tenant.context;

  if (!isSubscriptionActive(clinic)) {
    return NextResponse.json({ message: "Assinatura inativa." }, { status: 403 });
  }

  if (!getPlanEntitlements(clinic.subscriptionPlan).advancedReports) {
    return NextResponse.json({ message: "A exportação está disponível no plano Empresa." }, { status: 403 });
  }

  const fromValue = request.nextUrl.searchParams.get("from");
  const toValue = request.nextUrl.searchParams.get("to");
  const from = fromValue ? parseClinicDateTime(`${fromValue}T00:00`, clinic.timeZone) ?? undefined : undefined;
  const toStart = toValue ? parseClinicDateTime(`${toValue}T00:00`, clinic.timeZone) : null;
  const to = toStart ? new Date(toStart.getTime() + 24 * 60 * 60_000) : undefined;
  const clinicIds = await getAuthorizedReportClinicIds(tenant.context);
  const appointments = await getReportAppointmentsForExport(clinic, { from, to, clinicIds });
  const csv = buildAppointmentsCsv(appointments, clinic.timeZone);
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinic.timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamentos-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
