import { NextRequest, NextResponse } from "next/server";

import { getUpcomingAppointments } from "@/server/services/appointments";
import prisma from "@/lib/prisma";
import { getApiTenant } from "@/server/tenant";
import { z } from "zod";
import { checkApiRateLimit } from "@/lib/api-rate-limit";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "appointments-upcoming");
  if (rateLimitResponse) return rateLimitResponse;
  const { clinic, membership, role } = tenant.context;
  const professional = role === "PROVIDER" ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } }) : null;
  if (role === "PROVIDER" && !professional) return NextResponse.json([]);

  const searchParams = request.nextUrl.searchParams;
  const parsedLimit = z.coerce.number().int().min(1).max(50).safeParse(searchParams.get("limit") ?? "10");
  const limit = parsedLimit.success ? parsedLimit.data : 10;

  const appointments = await getUpcomingAppointments(clinic, limit, professional?.id);
  return NextResponse.json(appointments);
}
