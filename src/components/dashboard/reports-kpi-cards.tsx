import { CalendarXIcon, CircleDollarSignIcon, ReceiptTextIcon, RotateCcwIcon, TrendingUpIcon, UserRoundXIcon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import type { ReportsMetrics } from "@/server/services/reports";
import { formatCurrency } from "@/lib/formatters";

interface ReportsKpiCardsProps {
  metrics: ReportsMetrics;
}

export function ReportsKpiCards({ metrics }: ReportsKpiCardsProps) {
  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        title="Taxa de confirmação"
        value={`${metrics.confirmationRate}%`}
        description="Confirmados e concluídos no período, exceto cancelados."
        icon={TrendingUpIcon}
        accent="success"
      />
      <MetricCard
        title="Taxa de falta"
        value={`${metrics.noShowRate}%`}
        description="Não comparecimentos no período, exceto cancelados."
        icon={UserRoundXIcon}
        accent={metrics.noShowRate > 0 ? "warning" : "success"}
      />
      <MetricCard
        title="Clientes ativos"
        value={String(metrics.activeCustomersThisMonth)}
        description="Com ao menos um atendimento no período, exceto cancelados."
        icon={UsersIcon}
        accent="default"
      />
      <MetricCard
        title="Receita concluída"
        value={formatCurrency(metrics.completedRevenue)}
        description="Soma dos atendimentos concluídos no período."
        icon={CircleDollarSignIcon}
        accent="success"
      />
      <MetricCard
        title="Ticket médio"
        value={formatCurrency(metrics.averageTicket)}
        description="Valor médio por atendimento concluído."
        icon={ReceiptTextIcon}
        accent="default"
      />
      <MetricCard
        title="Taxa de cancelamento"
        value={`${metrics.cancellationRate}%`}
        description="Cancelamentos sobre todos os horários do período."
        icon={CalendarXIcon}
        accent={metrics.cancellationRate > 0 ? "destructive" : "success"}
      />
      <MetricCard
        title="Clientes recorrentes"
        value={String(metrics.returningCustomers)}
        description="Clientes com dois ou mais atendimentos no período."
        icon={RotateCcwIcon}
        accent="default"
      />
    </section>
  );
}
