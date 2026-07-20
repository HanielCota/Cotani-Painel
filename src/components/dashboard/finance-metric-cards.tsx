import { CalendarIcon, TrendingDownIcon, TrendingUpIcon, WalletIcon, XCircleIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import type { FinanceMetrics } from "@/server/services/finance";

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface FinanceMetricCardsProps {
  metrics: FinanceMetrics;
}

export function FinanceMetricCards({ metrics }: FinanceMetricCardsProps) {
  const changeIsPositive = metrics.revenueChangePercent !== null && metrics.revenueChangePercent >= 0;

  return (
    <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Receita do mês"
        value={priceFormatter.format(metrics.currentMonthRevenue)}
        description={
          metrics.revenueChangePercent !== null
            ? `${changeIsPositive ? "+" : ""}${metrics.revenueChangePercent}% vs mês anterior`
            : "Sem dados do mês anterior"
        }
        icon={WalletIcon}
        accent="success"
      />

      <MetricCard
        title="Agendamentos do mês"
        value={String(metrics.monthAppointmentsTotal)}
        description={`${metrics.monthConfirmedCount + metrics.monthCompletedCount} confirmados/completados`}
        icon={CalendarIcon}
        accent="default"
      />

      <MetricCard
        title="Cancelados"
        value={String(metrics.monthCanceledCount)}
        description="No mês atual"
        icon={XCircleIcon}
        accent="destructive"
      />

      <MetricCard
        title="Faltas (no-show)"
        value={String(metrics.monthNoShowCount)}
        description="No mês atual"
        icon={metrics.monthNoShowCount > 0 ? TrendingDownIcon : TrendingUpIcon}
        accent={metrics.monthNoShowCount > 0 ? "warning" : "success"}
      />
    </section>
  );
}
