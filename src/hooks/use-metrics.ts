"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { DashboardMetrics } from "@/types";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => fetchJson<DashboardMetrics>("/api/metrics"),
    refetchInterval: 30_000,
  });
}
