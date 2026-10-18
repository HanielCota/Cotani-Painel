import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp } from "@/lib/get-client-ip";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getAvailableSlots } from "@/server/services/availability";
import { bookingProfessionalSchema, resolveBookingProfessionals } from "@/server/services/booking-professionals";
import { isSubscriptionActive } from "@/server/subscription";

const querySchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: bookingProfessionalSchema.optional(),
});

const RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const ip = getClientIp(request);
  const limit = await rateLimit({ key: `availability:${ip}`, ...RATE_LIMIT });

  if (!limit.success) {
    return NextResponse.json({ message: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get("serviceId") ?? undefined,
    date: request.nextUrl.searchParams.get("date") ?? undefined,
    professionalId: request.nextUrl.searchParams.get("professionalId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Parâmetros de consulta inválidos." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: {
      id: true,
      timeZone: true,
      maxAppointmentsPerDay: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
      operationalStatus: true,
      subscriptionPlan: true,
      billingOwnerId: true,
      billingOwner: true,
    },
  });

  if (!clinic) {
    return NextResponse.json({ message: "Negócio não encontrado." }, { status: 404 });
  }

  if (!isSubscriptionActive(clinic) || clinic.operationalStatus !== "ACTIVE") {
    return NextResponse.json({ message: "Negócio indisponível para agendamentos." }, { status: 403 });
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true },
    select: { duration: true },
  });

  if (!service || service.duration <= 0) {
    return NextResponse.json({ message: "Serviço indisponível." }, { status: 404 });
  }

  const professionalIds = await resolveBookingProfessionals(
    clinic.id,
    parsed.data.serviceId,
    parsed.data.professionalId,
  );
  if (!professionalIds) {
    return NextResponse.json({ message: "Profissional indisponível para este serviço." }, { status: 404 });
  }

  const slots = await getAvailableSlots({
    clinicId: clinic.id,
    timeZone: clinic.timeZone,
    serviceDuration: service.duration,
    date: parsed.data.date,
    professionalIds,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
  });

  if (!slots) {
    return NextResponse.json({ message: "Data inválida." }, { status: 400 });
  }

  return NextResponse.json({ slots });
}
