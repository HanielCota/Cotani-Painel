import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";

// Horário comercial fixo do MVP: ainda não existe modelagem de expediente por
// clínica no schema, então os slots são gerados entre 08h e 18h (hora local da
// clínica) em passos de 30 minutos.
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const SLOT_STEP_MINUTES = 30;

const querySchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    where: { slug },
    select: { id: true, timeZone: true },
  });

  if (!clinic) {
    return NextResponse.json({ message: "Clínica não encontrada." }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true },
    select: { duration: true },
  });

  if (!service || service.duration <= 0) {
    return NextResponse.json({ message: "Serviço indisponível." }, { status: 404 });
  }

  const dayStart = parseClinicDateTime(`${parsed.data.date}T00:00`, clinic.timeZone);

  if (!dayStart) {
    return NextResponse.json({ message: "Data inválida." }, { status: 400 });
  }

  const { startOfTomorrow: dayEnd } = getClinicDateBounds(clinic.timeZone, dayStart);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      status: { not: "CANCELED" },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  });

  const now = new Date();
  const slots: Array<{ startTime: string; label: string }> = [];

  for (let minutes = BUSINESS_START_HOUR * 60; minutes + service.duration <= BUSINESS_END_HOUR * 60; minutes += SLOT_STEP_MINUTES) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    const startTime = parseClinicDateTime(`${parsed.data.date}T${hour}:${minute}`, clinic.timeZone);

    if (!startTime || startTime <= now) {
      continue;
    }

    const endTime = new Date(startTime.getTime() + service.duration * 60_000);
    const overlaps = appointments.some((appointment) => startTime < appointment.endTime && endTime > appointment.startTime);

    if (overlaps) {
      continue;
    }

    slots.push({ startTime: startTime.toISOString(), label: `${hour}:${minute}` });
  }

  return NextResponse.json({ slots });
}
