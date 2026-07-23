import { NextResponse } from "next/server";

import { getTodayAppointments } from "@/server/services/appointments";
import { requireActiveClinic } from "@/server/tenant";

export async function GET() {
  const clinic = await requireActiveClinic();

  if (!clinic) {
    return NextResponse.json({ message: "Clínica não encontrada." }, { status: 404 });
  }

  const appointments = await getTodayAppointments(clinic);
  return NextResponse.json(appointments);
}
