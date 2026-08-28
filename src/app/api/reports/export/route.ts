import { NextResponse } from "next/server";

import { getPlanEntitlements } from "@/config/subscription-plans";
import { buildAppointmentsCsv } from "@/server/services/reports-export";
import { getReportsMetrics } from "@/server/services/reports";
import { isSubscriptionActive } from "@/server/subscription";
import { getApiTenant } from "@/server/tenant";

export async function GET() {
  const tenant = await getApiTenant(["ADMIN"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic } = tenant.context;

  if (!isSubscriptionActive(clinic)) {
    return NextResponse.json({ message: "Assinatura inativa." }, { status: 403 });
  }

  if (!getPlanEntitlements(clinic.subscriptionPlan).advancedReports) {
    return NextResponse.json({ message: "A exportação está disponível no plano Empresa." }, { status: 403 });
  }

  const metrics = await getReportsMetrics(clinic);
  const csv = buildAppointmentsCsv(metrics.monthAppointments, clinic.timeZone);
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
