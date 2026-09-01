import Link from "next/link";

import type { FinancePeriod } from "@/server/services/finance";

const periods: Array<{ id: FinancePeriod; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7days", label: "Últimos 7 dias" },
  { id: "30days", label: "Últimos 30 dias" },
  { id: "month", label: "Este mês" },
  { id: "year", label: "Este ano" },
];

export function FinanceDateTabs({ activePeriod }: { activePeriod: FinancePeriod }) {
  return (
    <div role="group" aria-label="Período financeiro" className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {periods.map((period) => {
        const isActive = activePeriod === period.id;

        return (
          <Link
            key={period.id}
            href={`/dashboard/financeiro?period=${period.id}`}
            aria-current={isActive ? "page" : undefined}
            className={`min-h-9 rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {period.label}
          </Link>
        );
      })}
    </div>
  );
}
