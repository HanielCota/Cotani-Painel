import "server-only";

import type { AppointmentStatus } from "@/generated/prisma/enums";

import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { formatClinicDateKey, getClinicDateBounds, getClinicMonthlyBounds, parseClinicDateTime } from "@/lib/timezone";
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
  monthAppointments: FinanceAppointment[];
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

const paymentMethodLabels: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

const paymentMethodColors: Record<string, string> = {
  PIX: "#8B5CF6",
  CREDIT_CARD: "#F97316",
  DEBIT_CARD: "#3B82F6",
  CASH: "#10B981",
  OTHER: "#9CA3AF",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const statusColors: Record<string, string> = {
  PENDING: "#FBBF24",
  CONFIRMED: "#82D951",
  COMPLETED: "#3B82F6",
  CANCELED: "#EF4444",
  NO_SHOW: "#F97316",
};

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function financePeriodBounds(period: FinancePeriod, timeZone: string, now = new Date()) {
  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth, startOfPreviousMonth } = getClinicDateBounds(timeZone, now);
  const todayKey = formatClinicDateKey(now, timeZone);
  const year = Number(todayKey.slice(0, 4));

  if (period === "today") {
    return {
      start: startOfToday,
      end: startOfTomorrow,
      previousStart: parseClinicDateTime(`${shiftDateKey(todayKey, -1)}T00:00`, timeZone)!,
    };
  }

  if (period === "7days" || period === "30days") {
    const days = period === "7days" ? 7 : 30;
    const startKey = shiftDateKey(todayKey, -(days - 1));
    return {
      start: parseClinicDateTime(`${startKey}T00:00`, timeZone)!,
      end: startOfTomorrow,
      previousStart: parseClinicDateTime(`${shiftDateKey(startKey, -days)}T00:00`, timeZone)!,
    };
  }

  if (period === "year") {
    return {
      start: parseClinicDateTime(`${year}-01-01T00:00`, timeZone)!,
      end: parseClinicDateTime(`${year + 1}-01-01T00:00`, timeZone)!,
      previousStart: parseClinicDateTime(`${year - 1}-01-01T00:00`, timeZone)!,
    };
  }

  return { start: startOfMonth, end: startOfNextMonth, previousStart: startOfPreviousMonth };
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
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
    professionalName: appointment.professional?.name ?? null,
    servicePrice: Number(appointment.totalPrice),
    paymentMethod: appointment.paymentMethod,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    status: appointment.status,
  };
}

export async function getFinanceMetrics(clinic: ClinicModel, period: FinancePeriod = "month"): Promise<FinanceMetrics> {
  const {
    startOfMonth,
    startOfNextMonth,
  } = getClinicDateBounds(clinic.timeZone);
  const periodBounds = financePeriodBounds(period, clinic.timeZone);

  const monthlyBounds = getClinicMonthlyBounds(clinic.timeZone, 6);
  const historyStart = monthlyBounds[0]?.start ?? startOfMonth;

  const [currentMonthAppointments, previousMonthAppointments, historyAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: periodBounds.start, lt: periodBounds.end },
      },
      include: { service: true, customer: true, professional: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: periodBounds.previousStart, lt: periodBounds.start },
        status: "COMPLETED",
      },
      include: { service: true },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: historyStart, lt: startOfNextMonth },
        status: "COMPLETED",
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const currentMonthRevenue = currentMonthAppointments
    .filter((appointment) => appointment.status === "COMPLETED")
    .reduce((sum, appointment) => sum + Number(appointment.totalPrice), 0);
  const expectedRevenue = currentMonthAppointments
    .filter((appointment) => appointment.status === "PENDING" || appointment.status === "CONFIRMED")
    .reduce((sum, appointment) => sum + Number(appointment.totalPrice), 0);

  const previousMonthRevenue = previousMonthAppointments.reduce(
    (sum, appointment) => sum + Number(appointment.totalPrice),
    0,
  );

  const revenueChangePercent =
    previousMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : null;

  const monthPendingCount = currentMonthAppointments.filter((a) => a.status === "PENDING").length;
  const monthConfirmedCount = currentMonthAppointments.filter((a) => a.status === "CONFIRMED").length;
  const monthCompletedCount = currentMonthAppointments.filter((a) => a.status === "COMPLETED").length;
  const monthCanceledCount = currentMonthAppointments.filter((a) => a.status === "CANCELED").length;
  const monthNoShowCount = currentMonthAppointments.filter((a) => a.status === "NO_SHOW").length;

  const monthAppointments = currentMonthAppointments.map(toFinanceAppointment);
  const appointmentsByLocalDay = new Map<string, typeof currentMonthAppointments>();
  for (const appointment of currentMonthAppointments) {
    const key = formatClinicDateKey(appointment.startTime, clinic.timeZone);
    appointmentsByLocalDay.set(key, [...(appointmentsByLocalDay.get(key) ?? []), appointment]);
  }

  // Desempenho de vendas: agrupado por dia do mês atual.
  const dailyRevenueMap = new Map<string, number>();
  for (const appointment of currentMonthAppointments) {
    if (appointment.status !== "COMPLETED") continue;
    const dateKey = formatClinicDateKey(appointment.startTime, clinic.timeZone);
    const groupingKey = period === "year" ? dateKey.slice(0, 7) : dateKey;
    dailyRevenueMap.set(groupingKey, (dailyRevenueMap.get(groupingKey) ?? 0) + Number(appointment.totalPrice));
  }
  const dailyRevenue = Array.from(dailyRevenueMap.entries())
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, value]) => ({
      date: period === "year" ? `${date.slice(5, 7)}/${date.slice(2, 4)}` : `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      value,
    }));

  // Evolução mensal: receita e ticket médio dos últimos meses.
  const monthlyRevenue = monthlyBounds.map(({ label, start, end }) => {
    const monthAppointmentsInBounds = historyAppointments.filter(
      (a) => a.startTime >= start && a.startTime < end,
    );
    const revenue = monthAppointmentsInBounds.reduce((sum, a) => sum + Number(a.totalPrice), 0);
    const ticket = monthAppointmentsInBounds.length > 0 ? Math.round(revenue / monthAppointmentsInBounds.length) : 0;
    return { month: label, revenue, ticket };
  });

  // Séries diárias para micrográficos dos KPIs (últimos 14 dias do mês).
  const seriesDayKeys = Array.from(appointmentsByLocalDay.keys()).sort().slice(-14);
  const kpiSeries = {
    revenue: seriesDayKeys.map((dayKey) => {
      return (appointmentsByLocalDay.get(dayKey) ?? [])
        .filter((a) => a.status === "COMPLETED")
        .reduce((sum, a) => sum + Number(a.totalPrice), 0);
    }),
    forecast: seriesDayKeys.map((dayKey) => {
      return (appointmentsByLocalDay.get(dayKey) ?? [])
        .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
        .reduce((sum, a) => sum + Number(a.totalPrice), 0);
    }),
    ticket: seriesDayKeys.map((dayKey) => {
      const dayAppointments = (appointmentsByLocalDay.get(dayKey) ?? []).filter((a) => a.status === "COMPLETED");
      const dayRevenue = dayAppointments.reduce((sum, a) => sum + Number(a.totalPrice), 0);
      return dayAppointments.length > 0 ? Math.round(dayRevenue / dayAppointments.length) : 0;
    }),
    cancellations: seriesDayKeys.map((dayKey) => {
      return (appointmentsByLocalDay.get(dayKey) ?? []).filter((a) => a.status === "CANCELED" || a.status === "NO_SHOW").length;
    }),
  };

  // Distribuição de métodos de pagamento: apenas agendamentos confirmados/concluídos do mês.
  const paymentMethodCounts: Record<string, number> = {};
  for (const appointment of currentMonthAppointments) {
    if (appointment.status !== "COMPLETED") continue;
    paymentMethodCounts[appointment.paymentMethod] =
      (paymentMethodCounts[appointment.paymentMethod] ?? 0) + Number(appointment.totalPrice);
  }
  const totalPaymentMethodRevenue = Object.values(paymentMethodCounts).reduce((sum, value) => sum + value, 0);
  const paymentMethodDistribution = Object.entries(paymentMethodCounts)
    .map(([method, value]) => ({
      name: paymentMethodLabels[method] ?? method,
      value: totalPaymentMethodRevenue > 0 ? Math.round((value / totalPaymentMethodRevenue) * 100) : 0,
      color: paymentMethodColors[method] ?? "#9CA3AF",
    }))
    .sort((a, b) => b.value - a.value);

  // Distribuição de status: todos os agendamentos do mês.
  const statusCounts: Record<string, number> = {};
  for (const appointment of currentMonthAppointments) {
    statusCounts[appointment.status] = (statusCounts[appointment.status] ?? 0) + 1;
  }
  const statusDistribution = Object.entries(statusCounts)
    .map(([status, value]) => ({
      name: statusLabels[status] ?? status,
      value,
      color: statusColors[status] ?? "#9CA3AF",
    }))
    .sort((a, b) => b.value - a.value);

  // Receita realizada por dia da semana no período selecionado.
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const calendarMap: Record<string, number> = {};
  for (const day of dayNames) {
    calendarMap[day] = 0;
  }

  for (const appointment of currentMonthAppointments) {
    if (appointment.status !== "COMPLETED") continue;
    const localKey = formatClinicDateKey(appointment.startTime, clinic.timeZone);
    const localDay = new Date(`${localKey}T12:00:00.000Z`);
    const dayName = dayNames[localDay.getUTCDay()];
    calendarMap[dayName] += Number(appointment.totalPrice);
  }
  const calendarHeatmap = dayNames.map((day) => ({ day, value: calendarMap[day] }));

  return {
    currentMonthRevenue,
    expectedRevenue,
    previousMonthRevenue,
    revenueChangePercent,
    monthAppointmentsTotal: currentMonthAppointments.length,
    monthPendingCount,
    monthConfirmedCount,
    monthCompletedCount,
    monthCanceledCount,
    monthNoShowCount,
    monthAppointments,
    dailyRevenue,
    monthlyRevenue,
    paymentMethodDistribution,
    statusDistribution,
    calendarHeatmap,
    kpiSeries,
  };
}
