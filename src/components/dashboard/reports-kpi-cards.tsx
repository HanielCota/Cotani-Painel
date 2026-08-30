import { CalendarDaysIcon, TrendingUpIcon, UserRoundXIcon, UsersIcon } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import type { ReportsMetrics } from "@/server/services/reports";

interface ReportsKpiCardsProps {
  metrics: ReportsMetrics;
}

export function ReportsKpiCards({ metrics }: ReportsKpiCardsProps) {
  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        title="Taxa de confirmação"
        value={`${metrics.confirmationRate}%`}
        description="Confirmados e concluídos sobre os atendimentos do mês, exceto cancelados."
        icon={TrendingUpIcon}
        accent="success"
      />
      <MetricCard
        title="Taxa de falta"
        value={`${metrics.noShowRate}%`}
        description="Não comparecimentos sobre os atendimentos do mês, exceto cancelados."
        icon={UserRoundXIcon}
        accent={metrics.noShowRate > 0 ? "warning" : "success"}
      />
      <MetricCard
        title="Clientes ativos no mês"
        value={String(metrics.activeCustomersThisMonth)}
        description="Com ao menos um atendimento no mês, exceto cancelados."
        icon={UsersIcon}
        accent="default"
      />
      <MetricCard
        title="Total de agendamentos"
        value={String(metrics.totalAppointments)}
        description="Agendamentos históricos da loja."
        icon={CalendarDaysIcon}
        accent="default"
      />
      <MetricCard
        title="Base de clientes"
        value={String(metrics.totalCustomers)}
        description="Clientes cadastrados no sistema."
        icon={UsersIcon}
        accent="default"
      />
      <MetricCard
        title="Serviços ativos"
        value={String(metrics.totalServices)}
        description="Serviços disponíveis para agendamento."
        icon={CalendarDaysIcon}
        accent="default"
      />
    </section>
  );
}
