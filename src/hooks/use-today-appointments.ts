"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { AppointmentListItem } from "@/server/services/appointments";

export function useTodayAppointments() {
  return useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => fetchJson<AppointmentListItem[]>("/api/appointments/today"),
    refetchInterval: 30_000,
  });
}
