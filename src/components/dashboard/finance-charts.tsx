"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DailyRevenueData {
  date: string;
  value: number;
}

export interface MonthlyRevenueData {
  month: string;
  revenue: number;
  ticket: number;
}

export interface DistributionData {
  name: string;
  value: number;
  color: string;
}

export interface CalendarHeatmapData {
  day: string;
  values: number[];
}

function ChartCard({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#F3F4F6] bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index}>
            {entry.name ? `${entry.name}: ` : ""}
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

interface SalesPerformanceChartProps {
  data: DailyRevenueData[];
}

export function SalesPerformanceChart({ data }: SalesPerformanceChartProps) {
  return (
    <ChartCard title="Desempenho de vendas" className="lg:col-span-8">
      <div className="h-64 w-full sm:h-80">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhuma venda no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82D951" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#82D951" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#82D951"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

interface MrrEvolutionChartProps {
  data: MonthlyRevenueData[];
}

export function MrrEvolutionChart({ data }: MrrEvolutionChartProps) {
  return (
    <ChartCard title="Evolução (receita / ticket médio)">
      <div className="h-64 w-full sm:h-80">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhuma receita nos últimos meses
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" fill="#82D951" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

interface PaymentMethodsChartProps {
  data: DistributionData[];
}

export function PaymentMethodsChart({ data }: PaymentMethodsChartProps) {
  return (
    <ChartCard title="Métodos de pagamento">
      <div className="flex h-64 flex-col justify-center gap-6 sm:h-80">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhuma venda confirmada no mês
          </div>
        ) : (
          data.map((method) => (
            <div key={method.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{method.name}</span>
                <span className="font-semibold text-gray-900">{method.value}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${method.value}%`, backgroundColor: method.color }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </ChartCard>
  );
}

interface PaymentStatusChartProps {
  data: DistributionData[];
}

export function PaymentStatusChart({ data }: PaymentStatusChartProps) {
  return (
    <ChartCard title="Status de pagamento">
      <div className="h-64 w-full sm:h-80">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhum agendamento no mês
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

function getHeatmapColor(value: number) {
  if (value >= 1500) return "bg-lime-600";
  if (value >= 1000) return "bg-lime-500";
  if (value >= 600) return "bg-lime-400";
  if (value >= 300) return "bg-lime-300";
  if (value >= 100) return "bg-lime-200";
  return "bg-lime-100";
}

interface SalesCalendarHeatmapProps {
  data: CalendarHeatmapData[];
}

export function SalesCalendarHeatmap({ data }: SalesCalendarHeatmapProps) {
  const weekCount = data[0]?.values.length ?? 0;

  return (
    <ChartCard title="Calendário de vendas" className="lg:col-span-4">
      <div className="w-full lg:w-[350px]">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-8 gap-1 text-xs text-gray-400">
            <div />
            {Array.from({ length: weekCount }, (_, i) => (
              <div key={i} className="text-center">
                {i + 1}ª
              </div>
            ))}
          </div>
          {data.map((row) => (
            <div key={row.day} className="grid grid-cols-8 items-center gap-1">
              <span className="text-xs font-medium text-gray-500">{row.day}</span>
              {row.values.map((value, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-md ${getHeatmapColor(value)} transition-colors`}
                  title={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
