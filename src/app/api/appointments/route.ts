import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { orgId } = await auth.protect();

  const rateLimitResponse = await checkApiRateLimit(request, "appointments");
  if (rateLimitResponse) return rateLimitResponse;

  if (!orgId) {
    return NextResponse.json({ message: "Nenhuma barbearia selecionada." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { clerkOrgId: orgId, deletedAt: null },
  });

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
