"use client";

import { useState } from "react";

const periods = [
  { id: "today", label: "Hoje" },
  { id: "month", label: "Esse mês" },
  { id: "30days", label: "Últimos 30 dias" },
  { id: "year", label: "Esse ano" },
];

export function FinanceDateTabs() {
  const [activePeriod, setActivePeriod] = useState("month");

  return (
    <div role="group" aria-label="Período financeiro" className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {periods.map((period) => {
        const isActive = activePeriod === period.id;

        return (
          <button
            key={period.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => setActivePeriod(period.id)}
            className={`min-h-9 rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
