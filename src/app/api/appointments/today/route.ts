import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { getTodayAppointments } from "@/server/services/appointments";
import { getApiTenant } from "@/server/tenant";

export async function GET() {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic, membership, role } = tenant.context;
  const professional = role === "PROVIDER" ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } }) : null;
  if (role === "PROVIDER" && !professional) return NextResponse.json([]);

  const appointments = await getTodayAppointments(clinic, professional?.id);
  return NextResponse.json(appointments);
}
