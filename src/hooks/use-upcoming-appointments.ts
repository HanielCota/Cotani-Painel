"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { AppointmentListItem } from "@/server/services/appointments";

export function useUpcomingAppointments(limit = 10) {
  return useQuery({
    queryKey: ["appointments", "upcoming", limit],
    queryFn: () => fetchJson<AppointmentListItem[]>(`/api/appointments/upcoming?limit=${limit}`),
    refetchInterval: 30_000,
  });
}
