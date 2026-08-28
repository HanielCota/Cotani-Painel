import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { getDashboardMetrics } from "@/server/services/metrics";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "metrics");
  if (rateLimitResponse) return rateLimitResponse;
  return NextResponse.json(await getDashboardMetrics(tenant.context.clinic));
}
