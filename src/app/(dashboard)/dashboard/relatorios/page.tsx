import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";

import { ReportsAppointmentsTable } from "@/components/dashboard/reports-appointments-table";
import { ReportsKpiCards } from "@/components/dashboard/reports-kpi-cards";
import { ReportsMonthlyChart } from "@/components/dashboard/reports-monthly-chart";
import { ReportsTopProfessionals } from "@/components/dashboard/reports-top-professionals";
import { ReportsTopServices } from "@/components/dashboard/reports-top-services";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlanUpgradeRequired } from "@/components/dashboard/plan-upgrade-required";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReportsMetrics } from "@/server/services/reports";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Relatórios" };

export default withTenant(async ({ clinic }) => {
  const entitlements = getPlanEntitlements(clinic.subscriptionPlan);
  if (!entitlements.monthlyReports) {
    return <PlanUpgradeRequired feature="Relatórios mensais" />;
  }
  const metrics = await getReportsMetrics(clinic);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description={`Transforme a rotina da ${clinic.name} em decisões claras.`}
        actions={entitlements.advancedReports ? (
          <Button
            nativeButton={false}
            render={<a href="/api/reports/export" download />}
            variant="outline"
          >
            <DownloadIcon />
            Exportar CSV
          </Button>
        ) : undefined}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Indicadores do mês</h2>
        <ReportsKpiCards metrics={metrics} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Análise mensal</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ReportsMonthlyChart data={metrics.monthlyData} />
          </div>
          <div className="flex flex-col gap-4">
            <ReportsTopServices services={metrics.topServices} />
            <ReportsTopProfessionals professionals={metrics.topProfessionals} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Agendamentos do mês</h2>
        <ReportsAppointmentsTable appointments={metrics.monthAppointments} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Como os indicadores são calculados</CardTitle>
          <CardDescription>As taxas consideram o mês atual no fuso {clinic.timeZone}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Taxa de confirmação:</strong> atendimentos confirmados ou
            concluídos sobre todos os atendimentos do mês, exceto cancelados.
          </p>
          <p>
            <strong className="font-medium text-foreground">Taxa de falta:</strong> não comparecimentos sobre os
            atendimentos do mês, exceto cancelados.
          </p>
          <p>
            <strong className="font-medium text-foreground">Clientes ativos no mês:</strong> clientes com ao menos um
            atendimento no mês, exceto cancelados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
