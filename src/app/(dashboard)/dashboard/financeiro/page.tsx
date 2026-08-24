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
import { getFinanceMetrics } from "@/server/services/finance";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Financeiro" };

export default withTenant(async ({ clinic }) => {
  const metrics = await getFinanceMetrics(clinic);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">Acompanhe receitas, vendas e movimentação da {clinic.name}.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FinanceDateTabs />
      </div>

      <FinanceKpiCards
        currentMonthRevenue={metrics.currentMonthRevenue}
        previousMonthRevenue={metrics.previousMonthRevenue}
        monthAppointmentsTotal={metrics.monthAppointmentsTotal}
        monthConfirmedCount={metrics.monthConfirmedCount}
        monthCompletedCount={metrics.monthCompletedCount}
        monthCanceledCount={metrics.monthCanceledCount}
        monthNoShowCount={metrics.monthNoShowCount}
        kpiSeries={metrics.kpiSeries}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Desempenho e calendário</h2>
        <div className="grid gap-4 lg:grid-cols-12">
          <SalesPerformanceChart data={metrics.dailyRevenue} />
          <SalesCalendarHeatmap data={metrics.calendarHeatmap} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Análise mensal</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <MrrEvolutionChart data={metrics.monthlyRevenue} />
          <PaymentMethodsChart data={metrics.paymentMethodDistribution} />
          <PaymentStatusChart data={metrics.statusDistribution} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Transações recentes</h2>
        <FinanceTransactionsTable appointments={metrics.monthAppointments} />
      </section>
    </div>
  );
}, ["ADMIN"]);
