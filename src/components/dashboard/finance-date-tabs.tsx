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
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm">
      {periods.map((period) => {
        const isActive = activePeriod === period.id;

        return (
          <button
            key={period.id}
            type="button"
            onClick={() => setActivePeriod(period.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "border border-primary text-primary"
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
