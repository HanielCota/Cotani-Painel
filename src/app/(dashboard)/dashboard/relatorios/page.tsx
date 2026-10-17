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
import { getReportAppointmentsPage, getReportsMetrics } from "@/server/services/reports";
import { parseClinicDateTime } from "@/lib/timezone";
import { getAuthorizedReportClinicIds } from "@/server/services/report-scope";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { withTenant } from "@/server/with-tenant";
import { isSubscriptionActive } from "@/server/subscription";

export const metadata: Metadata = { title: "Relatórios" };

interface ReportsPageProps { searchParams: Promise<{ from?: string; to?: string; page?: string }> }
export default withTenant<ReportsPageProps>(async (context, { searchParams }) => {
  const { clinic } = context;
  const entitlements = getPlanEntitlements(clinic.subscriptionPlan);
  if (!isSubscriptionActive(clinic) || !entitlements.monthlyReports) {
    return <PlanUpgradeRequired feature="Relatórios mensais" />;
  }
  const query = await searchParams;
  const from = query.from ? parseClinicDateTime(`${query.from}T00:00`, clinic.timeZone) ?? undefined : undefined;
  const toStart = query.to ? parseClinicDateTime(`${query.to}T00:00`, clinic.timeZone) : null;
  const to = toStart ? new Date(toStart.getTime() + 24 * 60 * 60_000) : undefined;
  // Só administradores da loja principal veem relatórios consolidados das unidades.
  const unitIds = await getAuthorizedReportClinicIds(context);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const reportOptions = { from, to, clinicIds: unitIds };
  const [metrics, appointmentsPage] = await Promise.all([
    getReportsMetrics(clinic, reportOptions),
    getReportAppointmentsPage(clinic, reportOptions, page),
  ]);
  const insight = metrics.periodAppointmentsTotal === 0
    ? "Ainda não há atendimentos no período selecionado. Amplie o intervalo para comparar tendências."
    : metrics.noShowRate >= 10
      ? `A taxa de faltas chegou a ${metrics.noShowRate}%. Priorize confirmações nos dias com maior incidência.`
      : metrics.retentionRate < 25
        ? `A retenção está em ${metrics.retentionRate}%. Use a previsão de retorno dos clientes para estimular novos agendamentos.`
        : `A retenção está saudável em ${metrics.retentionRate}% e a taxa de faltas em ${metrics.noShowRate}%. Mantenha a rotina de confirmações.`;
  const exportQuery = new URLSearchParams(); if (query.from) exportQuery.set("from", query.from); if (query.to) exportQuery.set("to", query.to);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description={`Transforme a rotina da ${clinic.name} em decisões claras.`}
        actions={entitlements.advancedReports ? (
          <Button
            type="button"
            nativeButton={false}
            render={<a href={`/api/reports/export?${exportQuery}`} download />}
            variant="outline"
          >
            <DownloadIcon />
            Exportar CSV
          </Button>
        ) : undefined}
      />

      <Card size="sm">
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <Field className="min-w-40 flex-1 gap-1.5 sm:flex-none"><FieldLabel htmlFor="report-from">De</FieldLabel><Input id="report-from" name="from" type="date" defaultValue={query.from} /></Field>
            <Field className="min-w-40 flex-1 gap-1.5 sm:flex-none"><FieldLabel htmlFor="report-to">Até</FieldLabel><Input id="report-to" name="to" type="date" defaultValue={query.to} /></Field>
            <Button type="submit" variant="outline">Aplicar período</Button>
            {entitlements.advancedReports ? <Button type="button" nativeButton={false} variant="outline" render={<a href={`/api/reports/pdf?${exportQuery}`} download />}><DownloadIcon />Exportar PDF</Button> : null}
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Indicadores do período</h2>
        <ReportsKpiCards metrics={metrics} />
      </section>

      <section className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Retenção</CardTitle><CardDescription>Clientes com dois ou mais atendimentos no período.</CardDescription></CardHeader><CardContent className="text-3xl font-semibold">{metrics.retentionRate}%</CardContent></Card><Card><CardHeader><CardTitle>Faltas por dia</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{metrics.noShowsByWeekday.map((item) => <div key={item.day} className="flex justify-between"><span>{item.day}</span><strong>{item.count}</strong></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Confirmações enviadas</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{metrics.confirmationsByChannel.length ? metrics.confirmationsByChannel.map((item) => <div key={item.channel} className="flex justify-between"><span>{item.channel}</span><strong>{item.sent}</strong></div>) : <p className="text-muted-foreground">Nenhuma no período.</p>}</CardContent></Card></section>

      <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>Insight automático</CardTitle><CardDescription>Leitura objetiva dos indicadores do período.</CardDescription></CardHeader><CardContent><p className="text-sm">{insight}</p></CardContent></Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Análise do período</h2>
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
        <h2 className="text-base font-semibold text-foreground">Agendamentos do período</h2>
        <ReportsAppointmentsTable data={appointmentsPage} timeZone={clinic.timeZone} from={query.from} to={query.to} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Como os indicadores são calculados</CardTitle>
          <CardDescription>As taxas consideram o período selecionado e o horário local da sua empresa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Taxa de confirmação:</strong> atendimentos confirmados ou
            concluídos sobre todos os atendimentos do período, exceto cancelados.
          </p>
          <p>
            <strong className="font-medium text-foreground">Taxa de falta:</strong> não comparecimentos sobre os
            atendimentos do período, exceto cancelados.
          </p>
          <p>
            <strong className="font-medium text-foreground">Clientes ativos:</strong> clientes com ao menos um
            atendimento no período, exceto cancelados.
          </p>
          <p>
            <strong className="font-medium text-foreground">Receita concluída e ticket médio:</strong> consideram apenas
            atendimentos concluídos; o ticket é a receita dividida pela quantidade desses atendimentos.
          </p>
          <p>
            <strong className="font-medium text-foreground">Taxa de cancelamento:</strong> cancelamentos sobre todos os
            agendamentos criados no período.
          </p>
          <p>
            <strong className="font-medium text-foreground">Clientes recorrentes:</strong> clientes com dois ou mais
            atendimentos não cancelados no período.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
