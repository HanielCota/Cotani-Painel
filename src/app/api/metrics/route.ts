import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { getDashboardMetrics } from "@/server/services/metrics";
import { getApiTenant } from "@/server/tenant";
import { isSubscriptionActive } from "@/server/subscription";
import { getPlanEntitlements } from "@/config/subscription-plans";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "metrics");
  if (rateLimitResponse) return rateLimitResponse;
  const metrics = await getDashboardMetrics(tenant.context.clinic);
  const { clinic, role } = tenant.context;
  if (role !== "ADMIN" || !isSubscriptionActive(clinic) || !getPlanEntitlements(clinic.subscriptionPlan).finance) {
    return NextResponse.json({ ...metrics, estimatedRevenueToday: null, completedRevenueThisMonth: null, completedRevenuePreviousMonth: null });
  }
  return NextResponse.json(metrics);
}
