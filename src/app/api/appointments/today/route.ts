import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getTodayAppointments } from "@/server/services/appointments";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "appointments-today");
  if (rateLimitResponse) return rateLimitResponse;
  const { clinic, membership, role } = tenant.context;
  const professional = role === "PROVIDER" ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } }) : null;
  if (role === "PROVIDER" && !professional) return NextResponse.json([]);

  const appointments = await getTodayAppointments(clinic, professional?.id);
  return NextResponse.json(appointments);
}
