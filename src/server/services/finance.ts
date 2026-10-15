import "server-only";

import type { AppointmentStatus } from "@/generated/prisma/enums";

import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { appointmentStatusLabel } from "@/lib/display-labels";
import { paymentMethodLabel } from "@/lib/appointment-status";
import {
  formatClinicDateKey,
  getClinicDateBounds,
  getClinicMonthlyBounds,
  parseClinicDateTime,
  type MonthlyBounds,
} from "@/lib/timezone";
import type { AgendaAppointment } from "@/types";

export interface FinanceAppointment extends AgendaAppointment {
  servicePrice: number;
  paymentMethod: string;
}

export type FinancePeriod = "today" | "7days" | "30days" | "month" | "year";

export const financePeriodLabels: Record<FinancePeriod, string> = {
  today: "Hoje",
  "7days": "Últimos 7 dias",
  "30days": "Últimos 30 dias",
  month: "Este mês",
  year: "Este ano",
};

export interface FinanceMetrics {
  currentMonthRevenue: number;
  expectedRevenue: number;
  previousMonthRevenue: number;
  revenueChangePercent: number | null;
  monthAppointmentsTotal: number;
  monthPendingCount: number;
  monthConfirmedCount: number;
  monthCompletedCount: number;
  monthCanceledCount: number;
  monthNoShowCount: number;
  dailyRevenue: { date: string; value: number }[];
  monthlyRevenue: { month: string; revenue: number; ticket: number }[];
  paymentMethodDistribution: { name: string; value: number; color: string }[];
  statusDistribution: { name: string; value: number; color: string }[];
  calendarHeatmap: { day: string; value: number }[];
  kpiSeries: {
    revenue: number[];
    forecast: number[];
    ticket: number[];
    cancellations: number[];
  };
}

const paymentMethodColors: Record<string, string> = {
  PIX: "var(--chart-5)",
  CREDIT_CARD: "var(--chart-3)",
  DEBIT_CARD: "var(--chart-2)",
  CASH: "var(--chart-4)",
  OTHER: "var(--muted-foreground)",
};

const statusColors: Record<string, string> = {
  PENDING: "var(--warning)",
  CONFIRMED: "var(--primary)",
  COMPLETED: "var(--chart-2)",
  CANCELED: "var(--destructive)",
  NO_SHOW: "var(--chart-3)",
};

/** Ticket médio em centavos: arredondar para reais inteiros distorcia R$ 49,99 → R$ 50,00. */
function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function rawFinancePeriodBounds(period: FinancePeriod, timeZone: string, now: Date) {
  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth, startOfPreviousMonth } = getClinicDateBounds(
    timeZone,
    now,
  );
  const todayKey = formatClinicDateKey(now, timeZone);
  const year = Number(todayKey.slice(0, 4));

  if (period === "today") {
    return {
      start: startOfToday,
      end: startOfTomorrow,
      previousStart: clinicDateTime(`${shiftDateKey(todayKey, -1)}T00:00`, timeZone),
    };
  }

  if (period === "7days" || period === "30days") {
    const days = period === "7days" ? 7 : 30;
    const startKey = shiftDateKey(todayKey, -(days - 1));
    return {
      start: clinicDateTime(`${startKey}T00:00`, timeZone),
      end: startOfTomorrow,
      previousStart: clinicDateTime(`${shiftDateKey(startKey, -days)}T00:00`, timeZone),
    };
  }

  if (period === "year") {
    return {
      start: clinicDateTime(`${year}-01-01T00:00`, timeZone),
      end: clinicDateTime(`${year + 1}-01-01T00:00`, timeZone),
      previousStart: clinicDateTime(`${year - 1}-01-01T00:00`, timeZone),
    };
  }

  return { start: startOfMonth, end: startOfNextMonth, previousStart: startOfPreviousMonth };
}

/**
 * Limites do período e do período anterior equivalente. `previousEnd` corta o
 * período anterior no mesmo tempo decorrido do atual ("este mês até hoje" vs
 * "mês passado até o mesmo dia"), evitando comparar parcial com completo.
 */
export function financePeriodBounds(period: FinancePeriod, timeZone: string, now = new Date()) {
  const bounds = rawFinancePeriodBounds(period, timeZone, now);
  const elapsed = Math.max(0, Math.min(now.getTime(), bounds.end.getTime()) - bounds.start.getTime());
  const previousEnd = new Date(Math.min(bounds.previousStart.getTime() + elapsed, bounds.start.getTime()));
  return { ...bounds, previousEnd };
}

/** Data/hora no fuso do negócio a partir de uma chave gerada aqui mesmo; inválida é erro de programação. */
function clinicDateTime(value: string, timeZone: string): Date {
  const date = parseClinicDateTime(value, timeZone);
  if (!date) throw new Error(`Data inválida: ${value}`);
  return date;
}

export async function getFinanceAppointmentsPage(
  clinic: ClinicModel,
  period: FinancePeriod,
  page: number,
  pageSize = 15,
) {
  const bounds = financePeriodBounds(period, clinic.timeZone);
  const where = { clinicId: clinic.id, startTime: { gte: bounds.start, lt: bounds.end } };
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { service: true, customer: true, professional: true },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    items: appointments.map(toFinanceAppointment),
    total,
    page,
    pageSize,
  };
}

function toFinanceAppointment(appointment: {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  paymentMethod: string;
  totalPrice: unknown;
  customer: { name: string };
  service: { name: string; price: unknown };
  professional: { name: string } | null;
}): FinanceAppointment {
  return {
    id: appointment.id,
    customerId: "",
    serviceId: "",
    professionalId: null,
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
    professionalName: appointment.professional?.name ?? null,
    servicePrice: Number(appointment.totalPrice),
    paymentMethod: appointment.paymentMethod,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    status: appointment.status,
    notes: null,
    totalPrice: Number(appointment.totalPrice),
  };
}

type FinanceMetricsData = Awaited<ReturnType<typeof loadFinanceMetricsData>>;

type PeriodAppointment = FinanceMetricsData["periodAppointments"][number];

type PricedAppointment = { totalPrice: unknown };

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function isCompleted(appointment: { status: AppointmentStatus }) {
  return appointment.status === "COMPLETED";
}

function isForecast(appointment: { status: AppointmentStatus }) {
  return appointment.status === "PENDING" || appointment.status === "CONFIRMED";
}

function isCanceledOrNoShow(appointment: { status: AppointmentStatus }) {
  return appointment.status === "CANCELED" || appointment.status === "NO_SHOW";
}

function sumTotalPrice(appointments: readonly PricedAppointment[]) {
  return appointments.reduce((sum, appointment) => sum + Number(appointment.totalPrice), 0);
}

function averageTicket(appointments: readonly PricedAppointment[]) {
  return appointments.length > 0 ? roundCents(sumTotalPrice(appointments) / appointments.length) : 0;
}

function countWithStatus(appointments: readonly PeriodAppointment[], status: AppointmentStatus) {
  return appointments.filter((appointment) => appointment.status === status).length;
}

async function loadFinanceMetricsData(clinic: ClinicModel, period: FinancePeriod) {
  const { startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);
  const periodBounds = financePeriodBounds(period, clinic.timeZone);

  const monthlyBounds = getClinicMonthlyBounds(clinic.timeZone, 6);
  const historyStart = monthlyBounds[0]?.start ?? startOfMonth;

  const [periodAppointments, previousPeriodAppointments, historyAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: periodBounds.start, lt: periodBounds.end },
      },
      select: { startTime: true, status: true, paymentMethod: true, totalPrice: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: periodBounds.previousStart, lt: periodBounds.previousEnd },
        status: "COMPLETED",
      },
      select: { totalPrice: true },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: historyStart, lt: startOfNextMonth },
        status: "COMPLETED",
      },
      select: { startTime: true, totalPrice: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return { monthlyBounds, periodAppointments, previousPeriodAppointments, historyAppointments };
}

function summarizeRevenue(
  periodAppointments: readonly PeriodAppointment[],
  previousPeriodAppointments: readonly PricedAppointment[],
) {
  const currentMonthRevenue = sumTotalPrice(periodAppointments.filter(isCompleted));
  const expectedRevenue = sumTotalPrice(periodAppointments.filter(isForecast));
  const previousMonthRevenue = sumTotalPrice(previousPeriodAppointments);

  const revenueChangePercent =
    previousMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : null;

  return { currentMonthRevenue, expectedRevenue, previousMonthRevenue, revenueChangePercent };
}

function countAppointmentsByStatus(periodAppointments: readonly PeriodAppointment[]) {
  return {
    monthAppointmentsTotal: periodAppointments.length,
    monthPendingCount: countWithStatus(periodAppointments, "PENDING"),
    monthConfirmedCount: countWithStatus(periodAppointments, "CONFIRMED"),
    monthCompletedCount: countWithStatus(periodAppointments, "COMPLETED"),
    monthCanceledCount: countWithStatus(periodAppointments, "CANCELED"),
    monthNoShowCount: countWithStatus(periodAppointments, "NO_SHOW"),
  };
}

function formatDailyRevenueLabel(groupingKey: string, period: FinancePeriod) {
  if (period === "year") return `${groupingKey.slice(5, 7)}/${groupingKey.slice(2, 4)}`;
  return `${groupingKey.slice(8, 10)}/${groupingKey.slice(5, 7)}`;
}

/** Desempenho de vendas: agrupado por dia do período (ou por mês, no período anual). */
function buildDailyRevenue(periodAppointments: readonly PeriodAppointment[], period: FinancePeriod, timeZone: string) {
  const revenueByGroupingKey = new Map<string, number>();
  for (const appointment of periodAppointments.filter(isCompleted)) {
    const dateKey = formatClinicDateKey(appointment.startTime, timeZone);
    const groupingKey = period === "year" ? dateKey.slice(0, 7) : dateKey;
    revenueByGroupingKey.set(groupingKey, (revenueByGroupingKey.get(groupingKey) ?? 0) + Number(appointment.totalPrice));
  }

  return Array.from(revenueByGroupingKey.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, value]) => ({ date: formatDailyRevenueLabel(date, period), value }));
}

/** Evolução mensal: receita e ticket médio dos últimos meses. */
function buildMonthlyRevenue(
  monthlyBounds: readonly MonthlyBounds[],
  historyAppointments: FinanceMetricsData["historyAppointments"],
) {
  return monthlyBounds.map(({ label, start, end }) => {
    const appointmentsInMonth = historyAppointments.filter(
      (appointment) => appointment.startTime >= start && appointment.startTime < end,
    );
    return { month: label, revenue: sumTotalPrice(appointmentsInMonth), ticket: averageTicket(appointmentsInMonth) };
  });
}

function groupByLocalDay(periodAppointments: readonly PeriodAppointment[], timeZone: string) {
  const appointmentsByLocalDay = new Map<string, PeriodAppointment[]>();
  for (const appointment of periodAppointments) {
    const dayKey = formatClinicDateKey(appointment.startTime, timeZone);
    appointmentsByLocalDay.set(dayKey, [...(appointmentsByLocalDay.get(dayKey) ?? []), appointment]);
  }

  return appointmentsByLocalDay;
}

/** Séries diárias para micrográficos dos KPIs (últimos 14 dias com agendamentos). */
function buildKpiSeries(periodAppointments: readonly PeriodAppointment[], timeZone: string) {
  const appointmentsByLocalDay = groupByLocalDay(periodAppointments, timeZone);
  const seriesDays = Array.from(appointmentsByLocalDay.keys())
    .sort()
    .slice(-14)
    .map((dayKey) => appointmentsByLocalDay.get(dayKey) ?? []);

  return {
    revenue: seriesDays.map((dayAppointments) => sumTotalPrice(dayAppointments.filter(isCompleted))),
    forecast: seriesDays.map((dayAppointments) => sumTotalPrice(dayAppointments.filter(isForecast))),
    ticket: seriesDays.map((dayAppointments) => averageTicket(dayAppointments.filter(isCompleted))),
    cancellations: seriesDays.map((dayAppointments) => dayAppointments.filter(isCanceledOrNoShow).length),
  };
}

/** Distribuição de métodos de pagamento: percentual da receita realizada no período. */
function buildPaymentMethodDistribution(periodAppointments: readonly PeriodAppointment[]) {
  const revenueByMethod = periodAppointments
    .filter(isCompleted)
    .reduce<Record<string, number>>(
      (totals, appointment) => ({
        ...totals,
        [appointment.paymentMethod]: (totals[appointment.paymentMethod] ?? 0) + Number(appointment.totalPrice),
      }),
      {},
    );
  const totalRevenue = Object.values(revenueByMethod).reduce((sum, value) => sum + value, 0);

  return Object.entries(revenueByMethod)
    .map(([method, value]) => ({
      name: paymentMethodLabel(method),
      value: totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0,
      color: paymentMethodColors[method] ?? "var(--muted-foreground)",
    }))
    .sort((first, second) => second.value - first.value);
}

/** Distribuição de status: todos os agendamentos do período. */
function buildStatusDistribution(periodAppointments: readonly PeriodAppointment[]) {
  const countByStatus = periodAppointments.reduce<Record<string, number>>(
    (counts, appointment) => ({ ...counts, [appointment.status]: (counts[appointment.status] ?? 0) + 1 }),
    {},
  );

  return Object.entries(countByStatus)
    .map(([status, value]) => ({
      name: appointmentStatusLabel(status),
      value,
      color: statusColors[status] ?? "var(--muted-foreground)",
    }))
    .sort((first, second) => second.value - first.value);
}

function localWeekdayName(startTime: Date, timeZone: string) {
  const localKey = formatClinicDateKey(startTime, timeZone);
  const localDay = new Date(`${localKey}T12:00:00.000Z`);
  return weekdayNames[localDay.getUTCDay()];
}

/** Receita realizada por dia da semana no período selecionado. */
function buildCalendarHeatmap(periodAppointments: readonly PeriodAppointment[], timeZone: string) {
  const revenueByWeekday = periodAppointments
    .filter(isCompleted)
    .reduce<Record<string, number>>(
      (totals, appointment) => {
        const weekdayName = localWeekdayName(appointment.startTime, timeZone);
        return { ...totals, [weekdayName]: (totals[weekdayName] ?? 0) + Number(appointment.totalPrice) };
      },
      Object.fromEntries(weekdayNames.map((day) => [day, 0])),
    );

  return weekdayNames.map((day) => ({ day, value: revenueByWeekday[day] ?? 0 }));
}

export async function getFinanceMetrics(clinic: ClinicModel, period: FinancePeriod = "month"): Promise<FinanceMetrics> {
  const { monthlyBounds, periodAppointments, previousPeriodAppointments, historyAppointments } =
    await loadFinanceMetricsData(clinic, period);

  return {
    ...summarizeRevenue(periodAppointments, previousPeriodAppointments),
    ...countAppointmentsByStatus(periodAppointments),
    dailyRevenue: buildDailyRevenue(periodAppointments, period, clinic.timeZone),
    monthlyRevenue: buildMonthlyRevenue(monthlyBounds, historyAppointments),
    paymentMethodDistribution: buildPaymentMethodDistribution(periodAppointments),
    statusDistribution: buildStatusDistribution(periodAppointments),
    calendarHeatmap: buildCalendarHeatmap(periodAppointments, clinic.timeZone),
    kpiSeries: buildKpiSeries(periodAppointments, clinic.timeZone),
  };
}
