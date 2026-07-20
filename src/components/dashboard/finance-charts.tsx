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

const salesPerformanceData = [
  { date: "01/07", value: 2400 },
  { date: "05/07", value: 1800 },
  { date: "10/07", value: 3200 },
  { date: "15/07", value: 2800 },
  { date: "20/07", value: 4100 },
  { date: "25/07", value: 3600 },
  { date: "30/07", value: 5200 },
];

const mrrEvolutionData = [
  { month: "Jan", mrr: 4200, ticket: 85 },
  { month: "Fev", mrr: 4800, ticket: 92 },
  { month: "Mar", mrr: 5100, ticket: 88 },
  { month: "Abr", mrr: 4700, ticket: 95 },
  { month: "Mai", mrr: 6200, ticket: 102 },
  { month: "Jun", mrr: 5800, ticket: 98 },
  { month: "Jul", mrr: 7400, ticket: 110 },
];

const paymentMethodsData = [
  { name: "Cartão de Crédito", value: 45, color: "#F97316" },
  { name: "Pix", value: 35, color: "#8B5CF6" },
  { name: "Pix QR Code", value: 20, color: "#82D951" },
];

const paymentStatusData = [
  { name: "Pago", value: 72, color: "#82D951" },
  { name: "Pendente", value: 18, color: "#FBBF24" },
  { name: "Cancelado", value: 10, color: "#EF4444" },
];

function Card({ children, title, className = "" }: { children: React.ReactNode; title: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#F3F4F6] bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index}>
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function SalesPerformanceChart() {
  return (
    <Card title="Desempenho de vendas" className="lg:col-span-3">
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={salesPerformanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            <Area type="monotone" dataKey="value" stroke="#82D951" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function MrrEvolutionChart() {
  return (
    <Card title="Evolução (MRR / Ticket médio)">
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mrrEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} dy={10} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="mrr" fill="#82D951" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function PaymentMethodsChart() {
  return (
    <Card title="Métodos de pagamento">
      <div className="flex h-64 flex-col justify-center gap-6 sm:h-80">
        {paymentMethodsData.map((method) => (
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
        ))}
      </div>
    </Card>
  );
}

export function PaymentStatusChart() {
  return (
    <Card title="Status de pagamento">
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={paymentStatusData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {paymentStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}


