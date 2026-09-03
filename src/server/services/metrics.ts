import "server-only";

import { unstable_cache } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";
import type { DashboardMetrics } from "@/types";

export const getDashboardMetrics = unstable_cache(
  async function getDashboardMetrics(clinic: ClinicModel): Promise<DashboardMetrics> {
  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth, startOfPreviousMonth } = getClinicDateBounds(clinic.timeZone);

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
    previousMonthAppointmentsTotal,
    cancellationsThisMonth,
    newCustomersThisMonth,
    currentMonthRevenue,
    previousMonthRevenue,
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
    prisma.appointment.count({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfPreviousMonth, lt: startOfMonth },
        status: { not: "CANCELED" },
      },
    }),
    prisma.appointment.count({
      where: { clinicId: clinic.id, startTime: { gte: startOfMonth, lt: startOfNextMonth }, status: "CANCELED" },
    }),
    prisma.customer.count({ where: { clinicId: clinic.id, createdAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
    prisma.appointment.aggregate({
      where: { clinicId: clinic.id, startTime: { gte: startOfMonth, lt: startOfNextMonth }, status: "COMPLETED" },
      _sum: { totalPrice: true },
    }),
    prisma.appointment.aggregate({
      where: { clinicId: clinic.id, startTime: { gte: startOfPreviousMonth, lt: startOfMonth }, status: "COMPLETED" },
      _sum: { totalPrice: true },
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
    appointmentsThisMonth: monthAppointmentsTotal,
    appointmentsPreviousMonth: previousMonthAppointmentsTotal,
    completedRevenueThisMonth: Number(currentMonthRevenue._sum.totalPrice ?? 0),
    completedRevenuePreviousMonth: Number(previousMonthRevenue._sum.totalPrice ?? 0),
    cancellationsThisMonth,
    newCustomersThisMonth,
  };
  },
  ["dashboard-metrics"],
  { tags: ["dashboard-metrics"], revalidate: 60 },
);
