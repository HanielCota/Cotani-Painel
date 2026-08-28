"use client";

import { useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AgendaAppointment } from "@/types";

export function useAppointments() {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["appointments", clinicId],
    queryFn: () => fetchJson<AgendaAppointment[]>("/api/appointments"),
    refetchInterval: 30_000,
  });
}
