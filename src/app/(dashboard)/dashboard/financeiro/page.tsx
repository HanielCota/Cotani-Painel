import type { Metadata } from "next";

import {
  MrrEvolutionChart,
  PaymentMethodsChart,
  PaymentStatusChart,
  SalesCalendarHeatmap,
  SalesPerformanceChart,
} from "@/components/dashboard/finance-charts";
import { FinanceDateTabs } from "@/components/dashboard/finance-date-tabs";
import { FinanceKpiCards } from "@/components/dashboard/finance-kpi-cards";
import { FinanceTransactionsTable } from "@/components/dashboard/finance-transactions-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlanUpgradeRequired } from "@/components/dashboard/plan-upgrade-required";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { financePeriodLabels, getFinanceAppointmentsPage, getFinanceMetrics, type FinancePeriod } from "@/server/services/finance";
import { financePeriodBounds } from "@/server/services/finance";
import { FinanceEntriesManager } from "@/components/dashboard/finance-entries-manager";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";
import { isSubscriptionActive } from "@/server/subscription";

export const metadata: Metadata = { title: "Financeiro" };

interface FinancePageProps {
  searchParams: Promise<{ period?: string | string[]; page?: string; entriesPage?: string }>;
}

const financePeriods = new Set<FinancePeriod>(["today", "7days", "30days", "month", "year"]);

export default withTenant<FinancePageProps>(async ({ clinic }, { searchParams }) => {
  if (!isSubscriptionActive(clinic) || !getPlanEntitlements(clinic.subscriptionPlan).finance) {
    return <PlanUpgradeRequired feature="Controle financeiro" />;
  }
  const query = await searchParams;
  const rawPeriod = query.period;
  const requestedPeriod = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod;
  const period: FinancePeriod = requestedPeriod && financePeriods.has(requestedPeriod as FinancePeriod)
    ? requestedPeriod as FinancePeriod
    : "month";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const entriesPage = Math.max(1, Number.parseInt(query.entriesPage ?? "1", 10) || 1);
  const bounds = financePeriodBounds(period, clinic.timeZone);
  const entryWhere = { clinicId: clinic.id, occurredAt: { gte: bounds.start, lt: bounds.end } };
  const [metrics, appointmentPage, entries, entriesTotal, entryGroups] = await Promise.all([
    getFinanceMetrics(clinic, period),
    getFinanceAppointmentsPage(clinic, period, page),
    prisma.financialEntry.findMany({ where: entryWhere, orderBy: { occurredAt: "desc" }, skip: (entriesPage - 1) * 15, take: 15 }),
    prisma.financialEntry.count({ where: entryWhere }),
    prisma.financialEntry.groupBy({
      by: ["type", "status"],
      where: entryWhere,
      _sum: { amount: true, paidAmount: true },
    }),
  ]);
  const activeGroups = entryGroups.filter((item) => item.status !== "CANCELED" && item.status !== "REFUNDED");
  const received = activeGroups.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + Number(item._sum.paidAmount ?? 0), 0);
  const paid = activeGroups.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item._sum.paidAmount ?? 0), 0);
  const receivable = activeGroups.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + Math.max(0, Number(item._sum.amount ?? 0) - Number(item._sum.paidAmount ?? 0)), 0);
  const periodLabel = financePeriodLabels[period].toLocaleLowerCase("pt-BR");

  return (
    <div className="min-w-0 flex flex-col gap-5">
      <PageHeader
        title="Financeiro"
        description={`Acompanhe receitas, vendas e movimentação da ${clinic.name}.`}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FinanceDateTabs activePeriod={period} />
      </div>

      <FinanceKpiCards
        currentMonthRevenue={metrics.currentMonthRevenue}
        expectedRevenue={metrics.expectedRevenue}
        previousMonthRevenue={metrics.previousMonthRevenue}
        monthAppointmentsTotal={metrics.monthAppointmentsTotal}
        monthPendingCount={metrics.monthPendingCount}
        monthConfirmedCount={metrics.monthConfirmedCount}
        monthCompletedCount={metrics.monthCompletedCount}
        monthCanceledCount={metrics.monthCanceledCount}
        monthNoShowCount={metrics.monthNoShowCount}
        kpiSeries={metrics.kpiSeries}
      />

      <FinanceEntriesManager
        entries={entries.map((entry) => ({ id: entry.id, type: entry.type, status: entry.status, description: entry.description, category: entry.category, amount: Number(entry.amount), paidAmount: Number(entry.paidAmount), dueDate: entry.dueDate?.toISOString() ?? null, occurredAt: entry.occurredAt.toISOString(), notes: entry.notes }))}
        summary={{ received, paid, receivable, balance: received - paid }}
        pagination={{ page: entriesPage, total: entriesTotal, pageSize: 15, period, siblingPage: page }}
      />

      <section className="min-w-0 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Desempenho em {periodLabel}</h2>
        <div className="grid gap-4 lg:grid-cols-12">
          <SalesPerformanceChart data={metrics.dailyRevenue} />
          <SalesCalendarHeatmap data={metrics.calendarHeatmap} />
        </div>
      </section>

      <section className="min-w-0 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Contexto e composição</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <MrrEvolutionChart data={metrics.monthlyRevenue} />
          <PaymentMethodsChart data={metrics.paymentMethodDistribution} />
          <PaymentStatusChart data={metrics.statusDistribution} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Movimentações em {periodLabel}</h2>
        <FinanceTransactionsTable data={appointmentPage} timeZone={clinic.timeZone} period={period} siblingPage={entriesPage} />
      </section>
    </div>
  );
}, ["ADMIN"]);
