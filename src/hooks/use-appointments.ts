"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { AgendaAppointment } from "@/types";

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: () => fetchJson<AgendaAppointment[]>("/api/appointments"),
    refetchInterval: 30_000,
  });
}
