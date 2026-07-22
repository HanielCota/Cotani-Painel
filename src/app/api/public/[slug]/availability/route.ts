import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getAvailableSlots } from "@/server/services/availability";

const querySchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.uuid().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get("serviceId") ?? undefined,
    date: request.nextUrl.searchParams.get("date") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Parâmetros de consulta inválidos." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { slug, deletedAt: null },
    select: { id: true, timeZone: true, maxAppointmentsPerDay: true },
  });

  if (!clinic) {
    return NextResponse.json({ message: "Barbearia não encontrada." }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true },
    select: { duration: true },
  });

  if (!service || service.duration <= 0) {
    return NextResponse.json({ message: "Serviço indisponível." }, { status: 404 });
  }

  if (parsed.data.professionalId) {
    const professional = await prisma.professional.findFirst({
      where: {
        id: parsed.data.professionalId,
        clinicId: clinic.id,
        isActive: true,
        services: { some: { serviceId: parsed.data.serviceId } },
      },
      select: { id: true },
    });

    if (!professional) {
      return NextResponse.json({ message: "Profissional indisponível para este serviço." }, { status: 404 });
    }
  }

  const slots = await getAvailableSlots({
    clinicId: clinic.id,
    timeZone: clinic.timeZone,
    serviceDuration: service.duration,
    date: parsed.data.date,
    professionalId: parsed.data.professionalId,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
  });

  if (!slots) {
    return NextResponse.json({ message: "Data inválida." }, { status: 400 });
  }

  return NextResponse.json({ slots });
}
