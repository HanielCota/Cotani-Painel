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
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-[#F3F4F6] bg-white p-1 shadow-sm">
      {periods.map((period) => {
        const isActive = activePeriod === period.id;

        return (
          <button
            key={period.id}
            type="button"
            onClick={() => setActivePeriod(period.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "border border-lime-500 text-lime-600"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
