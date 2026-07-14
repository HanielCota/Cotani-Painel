"use client";

import { CalendarCheck2Icon, CircleAlertIcon, Clock3Icon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics } from "@/hooks/use-metrics";

export function DashboardMetricCards() {
  const { data: metrics, isPending, isError } = useMetrics();

  if (isPending) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Card key={card} className="border border-border/80 shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-16" />
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
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Agendamentos totais" value={String(metrics.totalAppointments)} description="Histórico da clínica" icon={CalendarCheck2Icon} />
      <MetricCard title="Confirmados hoje" value={String(metrics.confirmedToday)} description="Com confirmação registrada" icon={Clock3Icon} />
      <MetricCard title="No-shows no mês" value={String(metrics.noShowsThisMonth)} description="Para acompanhar de perto" icon={CircleAlertIcon} />
      <MetricCard title="Clientes" value={String(metrics.totalCustomers)} description="Base ativa da clínica" icon={UsersIcon} />
    </section>
  );
}
