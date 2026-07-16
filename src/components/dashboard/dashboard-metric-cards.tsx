"use client";

import { CalendarCheck2Icon, CircleDollarSignIcon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics } from "@/hooks/use-metrics";

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardMetricCards() {
  const { data: metrics, isPending, isError } = useMetrics();

  if (isPending) {
    return (
      <section className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <Card key={card} className="border border-border/80 shadow-sm" size="sm">
            <CardContent className="flex flex-col gap-2 pt-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  if (isError || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar as métricas</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        title="Agendamentos hoje"
        value={String(metrics.appointmentsToday)}
        description="Atendimentos reservados para hoje"
        icon={CalendarCheck2Icon}
      />
      <MetricCard
        title="Faturamento estimado"
        value={priceFormatter.format(metrics.estimatedRevenueToday)}
        description="Receita prevista com os agendamentos de hoje"
        icon={CircleDollarSignIcon}
      />
      <MetricCard
        title="Clientes atendidos"
        value={String(metrics.customersServedToday)}
        description="Clientes distintos no dia"
        icon={UsersIcon}
      />
    </section>
  );
}
