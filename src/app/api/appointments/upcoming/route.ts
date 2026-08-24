import { NextRequest, NextResponse } from "next/server";

import { getUpcomingAppointments } from "@/server/services/appointments";
import { getClinicForRoles } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return NextResponse.json({ message: "Clínica não encontrada." }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Number(searchParams.get("limit") ?? "10");

  const appointments = await getUpcomingAppointments(clinic, Number.isNaN(limit) ? 10 : limit);
  return NextResponse.json(appointments);
}
