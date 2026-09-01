import { CalendarCheck2Icon, CalendarRangeIcon, CircleDollarSignIcon, UserPlusIcon, UserRoundXIcon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import { getDashboardMetrics } from "@/server/services/metrics";

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardMetricCardsSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 7 }, (_, card) => (
        <Card key={card}>
          <CardContent className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

interface DashboardMetricCardsProps {
  clinic: ClinicModel;
}

export async function DashboardMetricCards({ clinic }: DashboardMetricCardsProps) {
  let metrics: Awaited<ReturnType<typeof getDashboardMetrics>> | null = null;
  let hasError = false;

  try {
    metrics = await getDashboardMetrics(clinic);
  } catch {
    hasError = true;
  }

  if (hasError || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar as métricas</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
      </Alert>
    );
  }

  const appointmentComparison = metrics.appointmentsPreviousMonth > 0
    ? Math.round(((metrics.appointmentsThisMonth - metrics.appointmentsPreviousMonth) / metrics.appointmentsPreviousMonth) * 100)
    : null;
  const revenueComparison = metrics.completedRevenuePreviousMonth > 0
    ? Math.round(((metrics.completedRevenueThisMonth - metrics.completedRevenuePreviousMonth) / metrics.completedRevenuePreviousMonth) * 100)
    : null;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        title="Agendamentos hoje"
        value={String(metrics.appointmentsToday)}
        description="Atendimentos reservados para hoje"
        icon={CalendarCheck2Icon}
        accent="default"
      />
      <MetricCard
        title="Faturamento estimado"
        value={priceFormatter.format(metrics.estimatedRevenueToday)}
        description="Receita prevista com os agendamentos de hoje"
        icon={CircleDollarSignIcon}
        accent="success"
      />
      <MetricCard
        title="Clientes atendidos"
        value={String(metrics.customersServedToday)}
        description="Clientes distintos no dia"
        icon={UsersIcon}
        accent="warning"
      />
      <MetricCard
        title="Agendamentos no mês"
        value={String(metrics.appointmentsThisMonth)}
        description={appointmentComparison === null ? "Ainda sem base no mês anterior" : `${appointmentComparison >= 0 ? "+" : ""}${appointmentComparison}% em relação ao mês anterior`}
        icon={CalendarRangeIcon}
        accent="default"
      />
      <MetricCard
        title="Receita concluída no mês"
        value={priceFormatter.format(metrics.completedRevenueThisMonth)}
        description={revenueComparison === null ? "Ainda sem base no mês anterior" : `${revenueComparison >= 0 ? "+" : ""}${revenueComparison}% em relação ao mês anterior`}
        icon={CircleDollarSignIcon}
        accent="success"
      />
      <MetricCard
        title="Cancelamentos no mês"
        value={String(metrics.cancellationsThisMonth)}
        description="Horários cancelados no período atual"
        icon={UserRoundXIcon}
        accent={metrics.cancellationsThisMonth > 0 ? "destructive" : "success"}
      />
      <MetricCard
        title="Clientes novos no mês"
        value={String(metrics.newCustomersThisMonth)}
        description="Novos contatos adicionados à base"
        icon={UserPlusIcon}
        accent="default"
      />
    </section>
  );
}
