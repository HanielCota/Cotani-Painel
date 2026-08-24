import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds, getClinicMonthlyBounds } from "@/lib/timezone";

export interface MonthlyReportData {
  month: string;
  appointments: number;
  revenue: number;
}

export interface TopServiceData {
  name: string;
  count: number;
  revenue: number;
}

export interface TopProfessionalData {
  name: string;
  count: number;
}

export interface ReportAppointment {
  id: string;
  customerName: string;
  serviceName: string;
  professionalName: string | null;
  startTime: string;
  status: string;
  servicePrice: number;
}

export interface ReportsMetrics {
  totalAppointments: number;
  totalCustomers: number;
  totalServices: number;
  activeCustomersThisMonth: number;
  confirmationRate: number;
  noShowRate: number;
  monthlyData: MonthlyReportData[];
  topServices: TopServiceData[];
  topProfessionals: TopProfessionalData[];
  monthAppointments: ReportAppointment[];
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export async function getReportsMetrics(clinic: ClinicModel): Promise<ReportsMetrics> {
  const { startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);
  const monthlyBounds = getClinicMonthlyBounds(clinic.timeZone, 6);
  const historyStart = monthlyBounds[0]?.start ?? startOfMonth;

  const [
    totalAppointments,
    totalCustomers,
    totalServices,
    monthAppointmentsResult,
    historyAppointments,
  ] = await Promise.all([
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
    prisma.customer.count({ where: { clinicId: clinic.id } }),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfMonth, lt: startOfNextMonth },
      },
      include: { service: true, customer: true, professional: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: historyStart, lt: startOfNextMonth },
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const monthAppointmentsTotal = monthAppointmentsResult.length;
  const confirmedOrCompletedThisMonth = monthAppointmentsResult.filter((a) =>
    ["CONFIRMED", "COMPLETED"].includes(a.status),
  ).length;
  const noShowsThisMonth = monthAppointmentsResult.filter((a) => a.status === "NO_SHOW").length;
  const activeCustomersThisMonth = new Set(
    monthAppointmentsResult.filter((a) => a.status !== "CANCELED").map((a) => a.customerId),
  ).size;

  const confirmationRate =
    monthAppointmentsTotal > 0
      ? Math.round((confirmedOrCompletedThisMonth / monthAppointmentsTotal) * 100)
      : 0;
  const noShowRate =
    monthAppointmentsTotal > 0 ? Math.round((noShowsThisMonth / monthAppointmentsTotal) * 100) : 0;

  // Dados mensais: agendamentos e receita por mês.
  const monthlyData: MonthlyReportData[] = monthlyBounds.map(({ label, start, end }) => {
    const appointmentsInBounds = historyAppointments.filter(
      (a) => a.startTime >= start && a.startTime < end,
    );
    const appointments = appointmentsInBounds.length;
    const revenue = appointmentsInBounds
      .filter((a) => a.status === "COMPLETED")
      .reduce((sum, a) => sum + Number(a.totalPrice), 0);
    return { month: label, appointments, revenue };
  });

  // Top serviços do mês atual.
  const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const appointment of monthAppointmentsResult) {
    if (appointment.status === "CANCELED") continue;
    const existing = serviceMap.get(appointment.serviceId);
    const price = Number(appointment.totalPrice);
    if (existing) {
      existing.count += 1;
      if (appointment.status === "COMPLETED") existing.revenue += price;
    } else {
      serviceMap.set(appointment.serviceId, {
        name: appointment.service.name,
        count: 1,
        revenue: appointment.status === "COMPLETED" ? price : 0,
      });
    }
  }
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top profissionais do mês atual.
  const professionalMap = new Map<string, { name: string; count: number }>();
  for (const appointment of monthAppointmentsResult) {
    if (appointment.status === "CANCELED" || !appointment.professional) continue;
    const existing = professionalMap.get(appointment.professionalId ?? "");
    if (existing) {
      existing.count += 1;
    } else if (appointment.professional) {
      professionalMap.set(appointment.professionalId ?? "", {
        name: appointment.professional.name,
        count: 1,
      });
    }
  }
  const topProfessionals = Array.from(professionalMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const monthAppointments: ReportAppointment[] = monthAppointmentsResult.map((appointment) => ({
    id: appointment.id,
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
    professionalName: appointment.professional?.name ?? null,
    startTime: appointment.startTime.toISOString(),
    status: appointment.status,
    servicePrice: Number(appointment.totalPrice),
  }));

  return {
    totalAppointments,
    totalCustomers,
    totalServices,
    activeCustomersThisMonth,
    confirmationRate,
    noShowRate,
    monthlyData,
    topServices,
    topProfessionals,
    monthAppointments,
  };
}

export { priceFormatter };
