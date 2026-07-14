"use client";

import { useQuery } from "@tanstack/react-query";

import type { DashboardMetrics } from "@/types";

async function fetchMetrics(): Promise<DashboardMetrics> {
  const response = await fetch("/api/metrics");

  if (!response.ok) {
    throw new Error("Não foi possível carregar as métricas.");
  }

  return response.json() as Promise<DashboardMetrics>;
}

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30_000,
  });
}
