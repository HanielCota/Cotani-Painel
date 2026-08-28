"use client";

import { useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AppointmentListItem } from "@/server/services/appointments";

export function useTodayAppointments() {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["appointments", clinicId, "today"],
    queryFn: () => fetchJson<AppointmentListItem[]>("/api/appointments/today"),
    refetchInterval: 30_000,
  });
}
