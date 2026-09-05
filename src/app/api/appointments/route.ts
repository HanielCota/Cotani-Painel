import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "appointments");
  if (rateLimitResponse) return rateLimitResponse;
  const { clinic, membership, role } = tenant.context;
  const professional = role === "PROVIDER"
    ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } })
    : null;
  if (role === "PROVIDER" && !professional) return NextResponse.json([]);

  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - 30);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      ...(professional ? { professionalId: professional.id } : {}),
      startTime: { gte: historyStart },
    },
    include: {
      customer: true,
      service: true,
      professional: true,
    },
    orderBy: { startTime: "asc" },
    take: 250,
  });

  return NextResponse.json(
    appointments.map((appointment) => ({
      id: appointment.id,
      customerId: appointment.customerId,
      serviceId: appointment.serviceId,
      professionalId: appointment.professionalId,
      customerName: appointment.customer.name,
      serviceName: appointment.service.name,
      professionalName: appointment.professional?.name ?? null,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
      totalPrice: Number(appointment.totalPrice),
    })),
  );
}
