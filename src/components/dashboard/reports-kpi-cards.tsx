"use client";

import { TrendingUpIcon, UserRoundXIcon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics } from "@/hooks/use-metrics";

export function ReportsKpiCards() {
  const { data: metrics, isPending, isError } = useMetrics();

  if (isPending) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((card) => (
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
        <AlertTitle>Não foi possível carregar os indicadores</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        title="Taxa de confirmação"
        value={`${metrics.confirmationRate}%`}
        description="Confirmados e concluídos sobre os atendimentos do mês, exceto cancelados."
        icon={TrendingUpIcon}
      />
      <MetricCard
        title="Taxa de falta"
        value={`${metrics.noShowRate}%`}
        description="Não comparecimentos sobre os atendimentos do mês, exceto cancelados."
        icon={UserRoundXIcon}
      />
      <MetricCard
        title="Clientes ativos no mês"
        value={String(metrics.activeCustomersThisMonth)}
        description="Com ao menos um atendimento no mês, exceto cancelados."
        icon={UsersIcon}
      />
    </section>
  );
}
