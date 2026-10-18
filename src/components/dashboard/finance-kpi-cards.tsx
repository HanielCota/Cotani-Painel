"use client";

import { BarChart3Icon, CalendarXIcon, CircleDollarSignIcon, WalletIcon } from "lucide-react";

import { Sparkline } from "@/components/dashboard/sparkline";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/formatters";

function KpiSparkline({ data }: { data?: number[] }) {
  return data && data.length > 1 ? <Sparkline data={data} width={140} height={32} /> : null;
}

interface FinanceKpiCardsProps {
  currentMonthRevenue: number;
  expectedRevenue: number;
  previousMonthRevenue: number;
  monthAppointmentsTotal: number;
  monthPendingCount: number;
  monthConfirmedCount: number;
  monthCompletedCount: number;
  monthCanceledCount: number;
  monthNoShowCount: number;
  kpiSeries?: {
    revenue: number[];
    forecast: number[];
    ticket: number[];
    cancellations: number[];
  };
}

export function FinanceKpiCards({
  currentMonthRevenue,
  expectedRevenue,
  previousMonthRevenue,
  monthAppointmentsTotal,
  monthPendingCount,
  monthConfirmedCount,
  monthCompletedCount,
  monthCanceledCount,
  monthNoShowCount,
  kpiSeries,
}: FinanceKpiCardsProps) {
  const revenueChangePercent =
    previousMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
      : null;

  const lost = monthCanceledCount + monthNoShowCount;
  const lostShare = monthAppointmentsTotal > 0 ? Math.round((lost / monthAppointmentsTotal) * 100) : 0;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores financeiros">
      <StatCard
        title="Receita realizada"
        value={formatCurrency(currentMonthRevenue)}
        icon={WalletIcon}
        tone="primary"
        description="Atendimentos concluídos no período"
        trend={revenueChangePercent !== null
          ? { label: `${revenueChangePercent > 0 ? "+" : ""}${revenueChangePercent}% vs. anterior`, direction: revenueChangePercent > 0 ? "up" : revenueChangePercent < 0 ? "down" : "flat" }
          : undefined}
      >
        <KpiSparkline data={kpiSeries?.revenue} />
      </StatCard>
      <StatCard
        title="Receita em aberto"
        value={formatCurrency(expectedRevenue)}
        icon={CircleDollarSignIcon}
        tone="info"
        description={`${monthPendingCount + monthConfirmedCount} agendamentos a realizar`}
      >
        <KpiSparkline data={kpiSeries?.forecast} />
      </StatCard>
      <StatCard
        title="Ticket médio"
        value={formatCurrency(monthCompletedCount > 0 ? currentMonthRevenue / monthCompletedCount : 0)}
        icon={BarChart3Icon}
        tone="success"
        description={`${monthCompletedCount} atendimentos concluídos`}
      >
        <KpiSparkline data={kpiSeries?.ticket} />
      </StatCard>
      <StatCard
        title="Cancelamentos e faltas"
        value={String(lost)}
        icon={CalendarXIcon}
        tone="destructive"
        description={`${lostShare}% dos agendamentos do período`}
      >
        <KpiSparkline data={kpiSeries?.cancellations} />
      </StatCard>
    </section>
  );
}
