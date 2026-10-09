import "server-only";

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
  cancellationRate: number;
  completedRevenue: number;
  averageTicket: number;
  returningCustomers: number;
  retentionRate: number;
  noShowsByWeekday: Array<{ day: string; count: number }>;
  confirmationsByChannel: Array<{ channel: string; sent: number }>;
  monthlyData: MonthlyReportData[];
  topServices: TopServiceData[];
  topProfessionals: TopProfessionalData[];
  periodAppointmentsTotal: number;
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface ReportsQueryOptions {
  from?: Date;
  to?: Date;
  clinicIds?: string[];
}

function getReportScope(clinic: ClinicModel, options?: ReportsQueryOptions) {
  const { startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);
  return {
    reportStart: options?.from ?? startOfMonth,
    reportEnd: options?.to ?? startOfNextMonth,
    clinicIds: options?.clinicIds?.length ? options.clinicIds : [clinic.id],
  };
}

function toReportAppointment(appointment: {
  id: string;
  startTime: Date;
  status: string;
  totalPrice: unknown;
  customer: { name: string };
  service: { name: string };
  professional: { name: string } | null;
}): ReportAppointment {
  return {
    id: appointment.id,
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
    professionalName: appointment.professional?.name ?? null,
    startTime: appointment.startTime.toISOString(),
    status: appointment.status,
    servicePrice: Number(appointment.totalPrice),
  };
}

export async function getReportAppointmentsPage(
  clinic: ClinicModel,
  options: ReportsQueryOptions,
  page: number,
  pageSize = 15,
) {
  const { reportStart, reportEnd, clinicIds } = getReportScope(clinic, options);
  const where = { clinicId: { in: clinicIds }, startTime: { gte: reportStart, lt: reportEnd } };
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { customer: true, service: true, professional: true },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);
  return { items: items.map(toReportAppointment), total, page, pageSize };
}

export async function getReportAppointmentsForExport(clinic: ClinicModel, options: ReportsQueryOptions) {
  const { reportStart, reportEnd, clinicIds } = getReportScope(clinic, options);
  const items = await prisma.appointment.findMany({
    where: { clinicId: { in: clinicIds }, startTime: { gte: reportStart, lt: reportEnd } },
    include: { customer: true, service: true, professional: true },
    orderBy: { startTime: "asc" },
  });
  return items.map(toReportAppointment);
}

export async function getReportsMetrics(clinic: ClinicModel, options?: ReportsQueryOptions): Promise<ReportsMetrics> {
  const { startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);
  const { reportStart, reportEnd, clinicIds } = getReportScope(clinic, options);
  const monthlyBounds = getClinicMonthlyBounds(clinic.timeZone, 8);
  const historyStart = monthlyBounds[0]?.start ?? startOfMonth;

  const [
    totalAppointments,
    totalCustomers,
    totalServices,
    monthAppointmentsResult,
    historyAppointments,
    confirmationNotifications,
  ] = await Promise.all([
    prisma.appointment.count({ where: { clinicId: { in: clinicIds } } }),
    prisma.customer.count({ where: { clinicId: { in: clinicIds } } }),
    prisma.service.count({ where: { clinicId: { in: clinicIds }, isActive: true } }),
    prisma.appointment.findMany({
      where: {
        clinicId: { in: clinicIds },
        startTime: { gte: reportStart, lt: reportEnd },
      },
      include: { service: true, customer: true, professional: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: { in: clinicIds },
        startTime: { gte: historyStart, lt: startOfNextMonth },
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.notification.groupBy({
      by: ["channel"],
      where: {
        clinicId: { in: clinicIds },
        kind: "CONFIRMATION",
        status: "SENT",
        sentAt: { gte: reportStart, lt: reportEnd },
      },
      _count: { _all: true },
    }),
  ]);

  const monthAppointmentsTotal = monthAppointmentsResult.filter(
    (appointment) => appointment.status !== "CANCELED",
  ).length;
  const confirmedOrCompletedThisMonth = monthAppointmentsResult.filter((a) =>
    ["CONFIRMED", "COMPLETED"].includes(a.status),
  ).length;
  const noShowsThisMonth = monthAppointmentsResult.filter((a) => a.status === "NO_SHOW").length;
  const canceledThisMonth = monthAppointmentsResult.filter((a) => a.status === "CANCELED").length;
  const completedThisMonth = monthAppointmentsResult.filter((a) => a.status === "COMPLETED");
  const completedRevenue = completedThisMonth.reduce((sum, appointment) => sum + Number(appointment.totalPrice), 0);
  const averageTicket = completedThisMonth.length > 0 ? completedRevenue / completedThisMonth.length : 0;
  const appointmentsByCustomer = new Map<string, number>();
  for (const appointment of monthAppointmentsResult) {
    if (appointment.status === "CANCELED") continue;
    appointmentsByCustomer.set(appointment.customerId, (appointmentsByCustomer.get(appointment.customerId) ?? 0) + 1);
  }
  const returningCustomers = Array.from(appointmentsByCustomer.values()).filter((count) => count >= 2).length;
  const activeCustomersThisMonth = new Set(
    monthAppointmentsResult.filter((a) => a.status !== "CANCELED").map((a) => a.customerId),
  ).size;
  const retentionRate = activeCustomersThisMonth
    ? Math.round((returningCustomers / activeCustomersThisMonth) * 100)
    : 0;
  const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const noShowCounts = Array.from({ length: 7 }, () => 0);
  for (const appointment of monthAppointmentsResult.filter((item) => item.status === "NO_SHOW")) {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: clinic.timeZone, weekday: "short" }).format(
      appointment.startTime,
    );
    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
    if (index >= 0) noShowCounts[index] += 1;
  }
  const noShowsByWeekday = weekdayLabels.map((day, index) => ({ day, count: noShowCounts[index] }));
  const confirmationsByChannel = confirmationNotifications.map((item) => ({
    channel: item.channel,
    sent: item._count._all,
  }));

  const confirmationRate =
    monthAppointmentsTotal > 0 ? Math.round((confirmedOrCompletedThisMonth / monthAppointmentsTotal) * 100) : 0;
  const noShowRate = monthAppointmentsTotal > 0 ? Math.round((noShowsThisMonth / monthAppointmentsTotal) * 100) : 0;
  const cancellationRate =
    monthAppointmentsResult.length > 0 ? Math.round((canceledThisMonth / monthAppointmentsResult.length) * 100) : 0;

  // Dados mensais: agendamentos e receita por mês.
  const monthlyData: MonthlyReportData[] = monthlyBounds.map(({ label, start, end }) => {
    const appointmentsInBounds = historyAppointments.filter((a) => a.startTime >= start && a.startTime < end);
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
    if (!existing) {
      serviceMap.set(appointment.serviceId, {
        name: appointment.service.name,
        count: 1,
        revenue: appointment.status === "COMPLETED" ? price : 0,
      });
      continue;
    }

    existing.count += 1;
    if (appointment.status === "COMPLETED") existing.revenue += price;
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
      continue;
    }

    professionalMap.set(appointment.professionalId ?? "", {
      name: appointment.professional.name,
      count: 1,
    });
  }
  const topProfessionals = Array.from(professionalMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAppointments,
    totalCustomers,
    totalServices,
    activeCustomersThisMonth,
    confirmationRate,
    noShowRate,
    cancellationRate,
    completedRevenue,
    averageTicket,
    returningCustomers,
    retentionRate,
    noShowsByWeekday,
    confirmationsByChannel,
    monthlyData,
    topServices,
    topProfessionals,
    periodAppointmentsTotal: monthAppointmentsResult.length,
  };
}

export { priceFormatter };
