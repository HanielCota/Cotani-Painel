"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyReportData } from "@/server/services/reports";

interface ReportsMonthlyChartProps {
  data: MonthlyReportData[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.dataKey === "revenue"
              ? `Receita: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(entry.value)}`
              : `Agendamentos: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function ReportsMonthlyChart({ data }: ReportsMonthlyChartProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <h3 className="mb-4 text-sm font-semibold text-card-foreground">Evolução mensal</h3>
      <div className="h-64 w-full sm:h-80">
        {data.length === 0 || data.every((d) => d.appointments === 0) ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum dado nos últimos meses
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dy={10} />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="bottom" height={36} />
              <Bar
                yAxisId="left"
                dataKey="appointments"
                name="Agendamentos"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke="var(--chart-2)"
                strokeWidth={3}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
