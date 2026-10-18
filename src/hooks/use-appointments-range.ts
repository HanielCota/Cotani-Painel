"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AgendaRange } from "@/types";

/** Agenda em grade. A chave começa com "appointments" para as ações existentes invalidarem também esta visão. */
export function useAppointmentsRange({ from, days }: { from: string; days: number }) {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["appointments", "range", clinicId, from, days],
    queryFn: () => fetchJson<AgendaRange>(`/api/appointments/range?${new URLSearchParams({ from, days: String(days) })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
