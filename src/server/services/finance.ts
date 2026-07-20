import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";
import type { AgendaAppointment } from "@/types";

export interface FinanceAppointment extends AgendaAppointment {
  servicePrice: number;
}

export interface FinanceMetrics {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  revenueChangePercent: number | null;
  monthAppointmentsTotal: number;
  monthConfirmedCount: number;
  monthCompletedCount: number;
  monthCanceledCount: number;
  monthNoShowCount: number;
  monthAppointments: FinanceAppointment[];
}

export async function getFinanceMetrics(clinic: ClinicModel): Promise<FinanceMetrics> {
  const {
    startOfMonth,
    startOfNextMonth,
    startOfPreviousMonth,
  } = getClinicDateBounds(clinic.timeZone);

  const [currentMonthAppointments, previousMonthAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfMonth, lt: startOfNextMonth },
      },
      include: { service: true, customer: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfPreviousMonth, lt: startOfMonth },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      include: { service: true },
    }),
  ]);

  const currentMonthRevenue = currentMonthAppointments
    .filter((appointment) => appointment.status === "CONFIRMED" || appointment.status === "COMPLETED")
    .reduce((sum, appointment) => sum + Number(appointment.service.price), 0);

  const previousMonthRevenue = previousMonthAppointments.reduce(
    (sum, appointment) => sum + Number(appointment.service.price),
    0,
  );

  const revenueChangePercent =
    previousMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : null;

  const monthConfirmedCount = currentMonthAppointments.filter((a) => a.status === "CONFIRMED").length;
  const monthCompletedCount = currentMonthAppointments.filter((a) => a.status === "COMPLETED").length;
  const monthCanceledCount = currentMonthAppointments.filter((a) => a.status === "CANCELED").length;
  const monthNoShowCount = currentMonthAppointments.filter((a) => a.status === "NO_SHOW").length;

  return {
    currentMonthRevenue,
    previousMonthRevenue,
    revenueChangePercent,
    monthAppointmentsTotal: currentMonthAppointments.length,
    monthConfirmedCount,
    monthCompletedCount,
    monthCanceledCount,
    monthNoShowCount,
    monthAppointments: currentMonthAppointments.map((appointment) => ({
      id: appointment.id,
      customerName: appointment.customer.name,
      serviceName: appointment.service.name,
      servicePrice: Number(appointment.service.price),
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status,
    })),
  };
}
