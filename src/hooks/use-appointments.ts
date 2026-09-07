"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AppointmentsPage } from "@/types";

export function useAppointments({ page, status, period }: { page: number; status: string; period: string }) {
  const clinicId = useActiveClinicId();
  const searchParams = new URLSearchParams({ page: String(page), status, period });
  return useQuery({
    queryKey: ["appointments", clinicId, page, status, period],
    queryFn: () => fetchJson<AppointmentsPage>(`/api/appointments?${searchParams.toString()}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
