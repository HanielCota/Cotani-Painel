import { unstable_cache } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";
import type { DashboardMetrics } from "@/types";

export const getDashboardMetrics = unstable_cache(
  async function getDashboardMetrics(clinic: ClinicModel): Promise<DashboardMetrics> {
  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);

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

  return {
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
  },
  ["dashboard-metrics"],
  { tags: ["dashboard-metrics"], revalidate: 60 },
);
