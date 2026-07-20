"use client";

import { TrendingUpIcon } from "lucide-react";

function Card({ children, title, className = "" }: { children: React.ReactNode; title: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#F3F4F6] bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-gray-400 sm:h-64">
      <TrendingUpIcon className="h-8 w-8 text-gray-300" />
      <p>Sem dados históricos</p>
      <p className="max-w-xs text-xs">{label}</p>
    </div>
  );
}

export function SalesPerformanceChart() {
  return (
    <Card title="Desempenho de vendas" className="lg:col-span-2">
      <EmptyState label="O gráfico de vendas será preenchido automaticamente conforme os agendamentos forem concluídos." />
    </Card>
  );
}

export function MrrEvolutionChart() {
  return (
    <Card title="Evolução (MRR / Ticket médio)">
      <EmptyState label="Dados de recorrência e ticket médio aparecerão aqui quando houver histórico de receita." />
    </Card>
  );
}

export function PaymentMethodsChart() {
  return (
    <Card title="Métodos de pagamento">
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-gray-400 sm:h-64">
        <TrendingUpIcon className="h-8 w-8 text-gray-300" />
        <p>Nenhum pagamento processado</p>
        <p className="max-w-xs text-xs">Os métodos de pagamento mais utilizados serão exibidos aqui.</p>
      </div>
    </Card>
  );
}

export function PaymentStatusChart() {
  return (
    <Card title="Status de pagamento">
      <EmptyState label="O resumo de status de pagamento será mostrado assim que existirem transações." />
    </Card>
  );
}

export function SalesCalendarHeatmap() {
  return (
    <Card title="Calendário de vendas" className="lg:col-span-2">
      <EmptyState label="O heatmap de vendas será gerado automaticamente com base nos agendamentos confirmados." />
    </Card>
  );
}
