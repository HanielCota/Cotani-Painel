import { NextResponse } from "next/server";

import { getTodayAppointments } from "@/server/services/appointments";
import { getClinicForRoles } from "@/server/tenant";

export async function GET() {
  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return NextResponse.json({ message: "Clínica não encontrada." }, { status: 404 });
  }

  const appointments = await getTodayAppointments(clinic);
  return NextResponse.json(appointments);
}
