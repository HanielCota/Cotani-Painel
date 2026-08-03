"use client";

import { AlertTriangle, BarChart3, DollarSign, ShoppingBag } from "lucide-react";

import { Sparkline } from "@/components/dashboard/sparkline";

interface FinanceKpiCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    isPositive: boolean;
  };
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconBg?: string;
  sparklineData?: number[];
}

function FinanceKpiCard({ title, value, change, icon: Icon, iconBg = "bg-primary/10", sparklineData }: FinanceKpiCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="size-6 text-primary" strokeWidth={1.5} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{value}</span>
          {change ? (
            <span className={`text-xs font-medium ${change.isPositive ? "text-primary" : "text-destructive"}`}>
              {change.isPositive ? "+" : ""}
              {change.value}
            </span>
          ) : null}
        </div>
        {sparklineData && sparklineData.length > 1 ? (
          <div className="mt-2">
            <Sparkline data={sparklineData} width={140} height={32} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface FinanceKpiCardsProps {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  monthAppointmentsTotal: number;
  monthConfirmedCount: number;
  monthCompletedCount: number;
  monthCanceledCount: number;
  monthNoShowCount: number;
  kpiSeries?: {
    revenue: number[];
    sales: number[];
    ticket: number[];
    cancellations: number[];
  };
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceKpiCards({
  currentMonthRevenue,
  previousMonthRevenue,
  monthAppointmentsTotal,
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

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FinanceKpiCard
        title="Receita do mês"
        value={priceFormatter.format(currentMonthRevenue)}
        change={
          revenueChangePercent !== null
            ? { value: `${revenueChangePercent}%`, isPositive: revenueChangePercent >= 0 }
            : undefined
        }
        icon={DollarSign}
        iconBg="bg-primary/10"
        sparklineData={kpiSeries?.revenue}
      />
      <FinanceKpiCard
        title="Total de vendas"
        value={String(monthAppointmentsTotal)}
        change={{
          value: `${monthConfirmedCount + monthCompletedCount} confirmados`,
          isPositive: true,
        }}
        icon={ShoppingBag}
        iconBg="bg-blue-500/10"
        sparklineData={kpiSeries?.sales}
      />
      <FinanceKpiCard
        title="Ticket médio"
        value={priceFormatter.format(
          monthAppointmentsTotal > 0 ? currentMonthRevenue / monthAppointmentsTotal : 0,
        )}
        icon={BarChart3}
        iconBg="bg-purple-500/10"
        sparklineData={kpiSeries?.ticket}
      />
      <FinanceKpiCard
        title="Cancelamentos"
        value={String(monthCanceledCount + monthNoShowCount)}
        change={{
          value: `${monthAppointmentsTotal > 0 ? Math.round(((monthCanceledCount + monthNoShowCount) / monthAppointmentsTotal) * 100) : 0}% do total`,
          isPositive: false,
        }}
        icon={AlertTriangle}
        iconBg="bg-destructive/10"
        sparklineData={kpiSeries?.cancellations}
      />
    </section>
  );
}
