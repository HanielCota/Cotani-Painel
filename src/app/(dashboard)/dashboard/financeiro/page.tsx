import type { Metadata } from "next";

import { FinanceAppointmentsTable } from "@/components/dashboard/finance-appointments-table";
import { FinanceMetricCards } from "@/components/dashboard/finance-metric-cards";
import { withTenant } from "@/server/with-tenant";
import { getFinanceMetrics } from "@/server/services/finance";

export const metadata: Metadata = { title: "Financeiro" };

export default withTenant(async ({ clinic }) => {
  const metrics = await getFinanceMetrics(clinic);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Acompanhe receitas e movimentação do mês da {clinic.name}.</p>
      </div>

      <FinanceMetricCards metrics={metrics} />
      <FinanceAppointmentsTable metrics={metrics} />
    </div>
  );
});
