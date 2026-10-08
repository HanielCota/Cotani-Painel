import { NextRequest, NextResponse } from "next/server";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { parseClinicDateRange } from "@/lib/timezone";
import { getReportAppointmentsForExport, getReportsMetrics } from "@/server/services/reports";
import { buildReportPdf } from "@/server/services/reports-pdf";
import { getAuthorizedReportClinicIds } from "@/server/services/report-scope";
import { isSubscriptionActive } from "@/server/subscription";
import { getApiTenant } from "@/server/tenant";

function formatDateKey(value: string | null) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  // Gerar PDF é mais caro que o CSV; mesmo limite da exportação em planilha.
  const rateLimitResponse = await checkApiRateLimit(request, "reports-pdf", 10, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const { clinic } = tenant.context;
  if (!isSubscriptionActive(clinic) || !getPlanEntitlements(clinic.subscriptionPlan).advancedReports) {
    return NextResponse.json({ message: "Exportação indisponível para este plano." }, { status: 403 });
  }

  const fromValue = request.nextUrl.searchParams.get("from");
  const toValue = request.nextUrl.searchParams.get("to");
  const { from, to } = parseClinicDateRange(fromValue, toValue, clinic.timeZone);
  const clinicIds = await getAuthorizedReportClinicIds(tenant.context);
  const [metrics, appointments] = await Promise.all([
    getReportsMetrics(clinic, { from, to, clinicIds }),
    getReportAppointmentsForExport(clinic, { from, to, clinicIds }),
  ]);

  const bytes = await buildReportPdf({
    clinicName: clinic.name,
    timeZone: clinic.timeZone,
    periodLabel: `${formatDateKey(fromValue) ?? "início do mês"} a ${formatDateKey(toValue) ?? "hoje"}`,
    metrics,
    appointments,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="relatorio-cotani.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
