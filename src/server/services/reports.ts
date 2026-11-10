import "server-only";

import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds, getClinicMonthlyBounds, type MonthlyBounds } from "@/lib/timezone";

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

type ReportsMetricsData = Awaited<ReturnType<typeof loadReportsMetricsData>>;

type PeriodAppointment = ReportsMetricsData["periodAppointments"][number];

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const englishWeekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isNotCanceled(appointment: { status: string }) {
  return appointment.status !== "CANCELED";
}

function isCompleted(appointment: { status: string }) {
  return appointment.status === "COMPLETED";
}

function percentOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function sumTotalPrice(appointments: readonly { totalPrice: unknown }[]) {
  return appointments.reduce((sum, appointment) => sum + Number(appointment.totalPrice), 0);
}

async function loadReportsMetricsData(clinic: ClinicModel, options?: ReportsQueryOptions) {
  const { startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);
  const { reportStart, reportEnd, clinicIds } = getReportScope(clinic, options);
  const monthlyBounds = getClinicMonthlyBounds(clinic.timeZone, 8);
  const historyStart = monthlyBounds[0]?.start ?? startOfMonth;

  const [
    totalAppointments,
    totalCustomers,
    totalServices,
    periodAppointments,
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

  return {
    monthlyBounds,
    totalAppointments,
    totalCustomers,
    totalServices,
    periodAppointments,
    historyAppointments,
    confirmationNotifications,
  };
}

/** Taxas do período: confirmação e falta sobre os não cancelados; cancelamento sobre todos. */
function summarizeRates(periodAppointments: readonly PeriodAppointment[]) {
  const activeAppointmentsTotal = periodAppointments.filter(isNotCanceled).length;
  const confirmedOrCompleted = periodAppointments.filter((appointment) =>
    ["CONFIRMED", "COMPLETED"].includes(appointment.status),
  ).length;
  const noShows = periodAppointments.filter((appointment) => appointment.status === "NO_SHOW").length;
  const canceled = periodAppointments.filter((appointment) => appointment.status === "CANCELED").length;

  return {
    confirmationRate: percentOf(confirmedOrCompleted, activeAppointmentsTotal),
    noShowRate: percentOf(noShows, activeAppointmentsTotal),
    cancellationRate: percentOf(canceled, periodAppointments.length),
  };
}

function summarizeCompletedRevenue(periodAppointments: readonly PeriodAppointment[]) {
  const completedAppointments = periodAppointments.filter(isCompleted);
  const completedRevenue = sumTotalPrice(completedAppointments);
  const averageTicket = completedAppointments.length > 0 ? completedRevenue / completedAppointments.length : 0;
  return { completedRevenue, averageTicket };
}

function summarizeCustomerRetention(periodAppointments: readonly PeriodAppointment[]) {
  const appointmentsByCustomer = new Map<string, number>();
  for (const appointment of periodAppointments.filter(isNotCanceled)) {
    appointmentsByCustomer.set(appointment.customerId, (appointmentsByCustomer.get(appointment.customerId) ?? 0) + 1);
  }

  const returningCustomers = Array.from(appointmentsByCustomer.values()).filter((count) => count >= 2).length;
  const activeCustomersThisMonth = appointmentsByCustomer.size;
  const retentionRate = activeCustomersThisMonth
    ? Math.round((returningCustomers / activeCustomersThisMonth) * 100)
    : 0;

  return { activeCustomersThisMonth, returningCustomers, retentionRate };
}

function buildNoShowsByWeekday(periodAppointments: readonly PeriodAppointment[], timeZone: string) {
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  const noShowWeekdayIndexes = periodAppointments
    .filter((appointment) => appointment.status === "NO_SHOW")
    .map((appointment) => englishWeekdayNames.indexOf(weekdayFormatter.format(appointment.startTime)));

  return weekdayLabels.map((day, weekdayIndex) => ({
    day,
    count: noShowWeekdayIndexes.filter((index) => index === weekdayIndex).length,
  }));
}

function buildConfirmationsByChannel(confirmationNotifications: ReportsMetricsData["confirmationNotifications"]) {
  return confirmationNotifications.map((item) => ({
    channel: item.channel,
    sent: item._count._all,
  }));
}

/** Dados mensais: agendamentos e receita realizada por mês. */
function buildMonthlyData(
  monthlyBounds: readonly MonthlyBounds[],
  historyAppointments: ReportsMetricsData["historyAppointments"],
): MonthlyReportData[] {
  return monthlyBounds.map(({ label, start, end }) => {
    const appointmentsInMonth = historyAppointments.filter(
      (appointment) => appointment.startTime >= start && appointment.startTime < end,
    );
    return {
      month: label,
      appointments: appointmentsInMonth.length,
      revenue: sumTotalPrice(appointmentsInMonth.filter(isCompleted)),
    };
  });
}

function addToServiceRanking(ranking: Map<string, TopServiceData>, appointment: PeriodAppointment) {
  const revenue = isCompleted(appointment) ? Number(appointment.totalPrice) : 0;
  const existing = ranking.get(appointment.serviceId);
  if (!existing) {
    ranking.set(appointment.serviceId, { name: appointment.service.name, count: 1, revenue });
    return ranking;
  }

  existing.count += 1;
  if (isCompleted(appointment)) existing.revenue += revenue;
  return ranking;
}

/** Top serviços do período, por quantidade de agendamentos não cancelados. */
function buildTopServices(periodAppointments: readonly PeriodAppointment[]) {
  const ranking = periodAppointments
    .filter(isNotCanceled)
    .reduce(addToServiceRanking, new Map<string, TopServiceData>());

  return Array.from(ranking.values())
    .sort((first, second) => second.count - first.count)
    .slice(0, 5);
}

function addToProfessionalRanking(ranking: Map<string, TopProfessionalData>, appointment: PeriodAppointment) {
  if (!appointment.professional) return ranking;

  const professionalKey = appointment.professionalId ?? "";
  const existing = ranking.get(professionalKey);
  if (existing) {
    existing.count += 1;
    return ranking;
  }

  ranking.set(professionalKey, { name: appointment.professional.name, count: 1 });
  return ranking;
}

/** Top profissionais do período, por quantidade de agendamentos não cancelados. */
function buildTopProfessionals(periodAppointments: readonly PeriodAppointment[]) {
  const ranking = periodAppointments
    .filter(isNotCanceled)
    .reduce(addToProfessionalRanking, new Map<string, TopProfessionalData>());

  return Array.from(ranking.values())
    .sort((first, second) => second.count - first.count)
    .slice(0, 5);
}

export async function getReportsMetrics(clinic: ClinicModel, options?: ReportsQueryOptions): Promise<ReportsMetrics> {
  const data = await loadReportsMetricsData(clinic, options);
  const { periodAppointments } = data;
  const rates = summarizeRates(periodAppointments);
  const customerRetention = summarizeCustomerRetention(periodAppointments);
  const completedRevenue = summarizeCompletedRevenue(periodAppointments);

  return {
    totalAppointments: data.totalAppointments,
    totalCustomers: data.totalCustomers,
    totalServices: data.totalServices,
    activeCustomersThisMonth: customerRetention.activeCustomersThisMonth,
    confirmationRate: rates.confirmationRate,
    noShowRate: rates.noShowRate,
    cancellationRate: rates.cancellationRate,
    completedRevenue: completedRevenue.completedRevenue,
    averageTicket: completedRevenue.averageTicket,
    returningCustomers: customerRetention.returningCustomers,
    retentionRate: customerRetention.retentionRate,
    noShowsByWeekday: buildNoShowsByWeekday(periodAppointments, clinic.timeZone),
    confirmationsByChannel: buildConfirmationsByChannel(data.confirmationNotifications),
    monthlyData: buildMonthlyData(data.monthlyBounds, data.historyAppointments),
    topServices: buildTopServices(periodAppointments),
    topProfessionals: buildTopProfessionals(periodAppointments),
    periodAppointmentsTotal: periodAppointments.length,
  };
}

export { priceFormatter };
