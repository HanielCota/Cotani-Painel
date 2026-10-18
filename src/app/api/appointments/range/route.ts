import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { addDaysToDateKey, formatClinicDateKey, isDateKey, parseClinicDateTime } from "@/lib/timezone";
import { getApiTenant } from "@/server/tenant";
import type { AgendaRange } from "@/types";

const MAX_DAYS = 7;
const MAX_ITEMS = 1_000;

/**
 * Atendimentos de um intervalo de dias (agenda em visão dia/semana), com o
 * expediente e os profissionais para montar a grade. PROVIDER vê apenas a
 * própria agenda, como na lista.
 */
export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "appointments");
  if (rateLimitResponse) return rateLimitResponse;

  const { clinic, membership, role } = tenant.context;
  const requestedFrom = request.nextUrl.searchParams.get("from");
  const from = isDateKey(requestedFrom) ? requestedFrom : formatClinicDateKey(new Date(), clinic.timeZone);
  const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? "1");
  const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), MAX_DAYS) : 1;
  const start = parseClinicDateTime(`${from}T00:00`, clinic.timeZone);
  const end = parseClinicDateTime(`${addDaysToDateKey(from, days)}T00:00`, clinic.timeZone);
  if (!start || !end) return NextResponse.json({ message: "Período inválido." }, { status: 400 });

  const ownProfessional = role === "PROVIDER"
    ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true, name: true } })
    : null;
  if (role === "PROVIDER" && !ownProfessional) {
    const empty: AgendaRange = { from, days, timeZone: clinic.timeZone, items: [], professionals: [], hours: [] };
    return NextResponse.json(empty, { headers: { "Cache-Control": "private, no-store" } });
  }

  const [appointments, professionals, hours] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        ...(ownProfessional ? { professionalId: ownProfessional.id } : {}),
        startTime: { lt: end },
        endTime: { gt: start },
      },
      include: { customer: { select: { name: true } }, service: { select: { name: true } }, professional: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: MAX_ITEMS,
    }),
    ownProfessional
      ? Promise.resolve([ownProfessional])
      : prisma.professional.findMany({ where: { clinicId: clinic.id, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.businessHour.findMany({ where: { clinicId: clinic.id }, select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true } }),
  ]);

  const body: AgendaRange = {
    from,
    days,
    timeZone: clinic.timeZone,
    professionals,
    hours,
    items: appointments.map((appointment) => ({
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
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
