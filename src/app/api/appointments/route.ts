import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getClinicDateBounds } from "@/lib/timezone";
import { getApiTenant } from "@/server/tenant";

const PAGE_SIZE = 15;
const statuses = new Set(["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]);
const periods = new Set(["ALL", "TODAY", "WEEK", "UPCOMING", "HISTORY"]);

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST", "PROVIDER"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const rateLimitResponse = await checkApiRateLimit(request, "appointments");
  if (rateLimitResponse) return rateLimitResponse;
  const { clinic, membership, role } = tenant.context;
  const professional = role === "PROVIDER"
    ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } })
    : null;
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const requestedStatus = request.nextUrl.searchParams.get("status") ?? "ALL";
  const status = statuses.has(requestedStatus) ? requestedStatus : "ALL";
  const requestedPeriod = request.nextUrl.searchParams.get("period") ?? "ALL";
  const period = periods.has(requestedPeriod) ? requestedPeriod : "ALL";

  if (role === "PROVIDER" && !professional) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  }

  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - 30);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const { startOfToday, startOfTomorrow } = getClinicDateBounds(clinic.timeZone);
  const startTime: Prisma.DateTimeFilter = period === "TODAY"
    ? { gte: startOfToday, lt: startOfTomorrow }
    : period === "WEEK"
      ? { gte: now, lte: weekEnd }
      : period === "UPCOMING"
        ? { gte: now }
        : period === "HISTORY"
          ? { gte: historyStart, lt: now }
          : { gte: historyStart };
  const where: Prisma.AppointmentWhereInput = {
    clinicId: clinic.id,
    ...(professional ? { professionalId: professional.id } : {}),
    ...(status !== "ALL" ? { status: status as Prisma.EnumAppointmentStatusFilter["equals"] } : {}),
    startTime,
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { customer: true, service: true, professional: true },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.appointment.count({ where }),
  ]);

  return NextResponse.json({
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
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
