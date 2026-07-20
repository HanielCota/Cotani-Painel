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
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
          Financeiro
        </h1>
        <p className="text-sm text-gray-500">Acompanhe receitas, vendas e movimentação da {clinic.name}.</p>
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
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <SalesPerformanceChart />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SalesCalendarHeatmap />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MrrEvolutionChart />
        <PaymentMethodsChart />
        <PaymentStatusChart />
      </section>

      <FinanceTransactionsTable appointments={metrics.monthAppointments} />
    </div>
  );
});
