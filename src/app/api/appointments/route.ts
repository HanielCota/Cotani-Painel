import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export async function GET() {
  const { orgId } = await auth.protect();

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
