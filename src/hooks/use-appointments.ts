"use client";

import { useQuery } from "@tanstack/react-query";

import type { AgendaAppointment } from "@/types";

async function fetchAppointments(): Promise<AgendaAppointment[]> {
  const response = await fetch("/api/appointments");

  if (!response.ok) {
    throw new Error("Não foi possível carregar os agendamentos.");
  }

  return response.json() as Promise<AgendaAppointment[]>;
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: fetchAppointments,
  });
}
