"use client";

import { useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AppointmentListItem } from "@/server/services/appointments";

export function useUpcomingAppointments(limit = 10) {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["appointments", clinicId, "upcoming", limit],
    queryFn: () => fetchJson<AppointmentListItem[]>(`/api/appointments/upcoming?limit=${limit}`),
    refetchInterval: 30_000,
  });
}
