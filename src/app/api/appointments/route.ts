import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getClinicForRoles } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "appointments");
  if (rateLimitResponse) return rateLimitResponse;

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return NextResponse.json({ message: "A barbearia ativa ainda não foi sincronizada." }, { status: 404 });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      startTime: { gte: new Date() },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    include: {
      customer: true,
      service: true,
      professional: true,
    },
    orderBy: { startTime: "asc" },
    take: 50,
  });

  return NextResponse.json(
    appointments.map((appointment) => ({
      id: appointment.id,
      customerName: appointment.customer.name,
      serviceName: appointment.service.name,
      professionalName: appointment.professional?.name ?? null,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status,
    })),
  );
}
