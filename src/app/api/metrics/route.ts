import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";
import type { Prisma } from "@/generated/prisma/client";
import type { DashboardMetrics } from "@/types";
import { getClinicForRoles } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "metrics");
  if (rateLimitResponse) return rateLimitResponse;

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return NextResponse.json({ message: "A barbearia ativa ainda não foi sincronizada." }, { status: 404 });
  }

  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);

  // Denominador das taxas: atendimentos do mês (calendário, no fuso da barbearia), exceto cancelados.
  const monthAppointments: Prisma.AppointmentWhereInput = {
    clinicId: clinic.id,
    startTime: { gte: startOfMonth, lt: startOfNextMonth },
    status: { not: "CANCELED" },
  };

  const todayAppointmentsWhere: Prisma.AppointmentWhereInput = {
    clinicId: clinic.id,
    startTime: { gte: startOfToday, lt: startOfTomorrow },
    status: { in: ["PENDING", "CONFIRMED"] },
  };

  const [
    totalAppointments,
    confirmedToday,
    noShowsThisMonth,
    totalCustomers,
    totalServices,
    monthAppointmentsTotal,
    confirmedOrCompletedThisMonth,
    activeCustomers,
    todayAppointments,
  ] = await Promise.all([
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
    prisma.appointment.count({
      where: { clinicId: clinic.id, startTime: { gte: startOfToday, lt: startOfTomorrow }, status: "CONFIRMED" },
    }),
    prisma.appointment.count({ where: { ...monthAppointments, status: "NO_SHOW" } }),
    prisma.customer.count({ where: { clinicId: clinic.id } }),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.appointment.count({ where: monthAppointments }),
    prisma.appointment.count({ where: { ...monthAppointments, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.appointment.findMany({ where: monthAppointments, distinct: ["customerId"], select: { customerId: true } }),
    prisma.appointment.findMany({
      where: todayAppointmentsWhere,
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const appointmentsToday = todayAppointments.length;
  const estimatedRevenueToday = todayAppointments.reduce(
    (sum, appointment) => sum + Number(appointment.totalPrice),
    0,
  );
  const customersServedToday = new Set(todayAppointments.map((appointment) => appointment.customerId)).size;

  const metrics: DashboardMetrics = {
    totalAppointments,
    confirmedToday,
    noShowsThisMonth,
    totalCustomers,
    totalServices,
    activeCustomersThisMonth: activeCustomers.length,
    confirmationRate: monthAppointmentsTotal > 0 ? Math.round((confirmedOrCompletedThisMonth / monthAppointmentsTotal) * 100) : 0,
    noShowRate: monthAppointmentsTotal > 0 ? Math.round((noShowsThisMonth / monthAppointmentsTotal) * 100) : 0,
    appointmentsToday,
    estimatedRevenueToday,
    customersServedToday,
  };

  return NextResponse.json(metrics);
}
