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
import { financePeriodLabels, getFinanceMetrics, type FinancePeriod } from "@/server/services/finance";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Financeiro" };

interface FinancePageProps {
  searchParams: Promise<{ period?: string | string[] }>;
}

const financePeriods = new Set<FinancePeriod>(["today", "7days", "30days", "month", "year"]);

export default withTenant<FinancePageProps>(async ({ clinic }, { searchParams }) => {
  if (!getPlanEntitlements(clinic.subscriptionPlan).finance) {
    return <PlanUpgradeRequired feature="Controle financeiro" />;
  }
  const rawPeriod = (await searchParams).period;
  const requestedPeriod = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod;
  const period: FinancePeriod = requestedPeriod && financePeriods.has(requestedPeriod as FinancePeriod)
    ? requestedPeriod as FinancePeriod
    : "month";
  const metrics = await getFinanceMetrics(clinic, period);
  const periodLabel = financePeriodLabels[period].toLocaleLowerCase("pt-BR");

  return (
    <div className="flex flex-col gap-5">
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

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Desempenho em {periodLabel}</h2>
        <div className="grid gap-4 lg:grid-cols-12">
          <SalesPerformanceChart data={metrics.dailyRevenue} />
          <SalesCalendarHeatmap data={metrics.calendarHeatmap} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Contexto e composição</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <MrrEvolutionChart data={metrics.monthlyRevenue} />
          <PaymentMethodsChart data={metrics.paymentMethodDistribution} />
          <PaymentStatusChart data={metrics.statusDistribution} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Movimentações em {periodLabel}</h2>
        <FinanceTransactionsTable appointments={metrics.monthAppointments.slice(0, 50)} />
      </section>
    </div>
  );
}, ["ADMIN"]);
