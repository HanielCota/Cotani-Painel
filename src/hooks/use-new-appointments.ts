"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useUpcomingAppointments } from "@/hooks/use-upcoming-appointments";

/**
 * Notificações = próximos agendamentos. O que já foi lido fica guardado no
 * navegador (ids), então o contador persiste entre páginas e recargas até o
 * usuário abrir o item ou marcar tudo como lido.
 */
const SEEN_STORAGE_KEY = "cotani-notifications-seen";
const MAX_SEEN_IDS = 300;
const EMPTY: readonly string[] = [];

const listeners = new Set<() => void>();
let seenSnapshot: readonly string[] | null = null;

function readSeen(): readonly string[] {
  if (seenSnapshot) return seenSnapshot;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) ?? "[]");
    seenSnapshot = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    seenSnapshot = [];
  }
  return seenSnapshot;
}

function writeSeen(ids: readonly string[]) {
  seenSnapshot = ids.slice(-MAX_SEEN_IDS);
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenSnapshot));
  } catch {
    // Armazenamento bloqueado: vale até recarregar a página.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Só para testes: esquece o estado em memória. */
export function resetSeenNotificationsForTests() {
  seenSnapshot = null;
}

export function useNewAppointments() {
  const appointmentsQuery = useUpcomingAppointments(20);
  const appointments = appointmentsQuery.data;
  const seen = useSyncExternalStore(subscribe, readSeen, () => EMPTY);

  // Chegadas desde a última consulta, para o aviso (toast); não muda o "lido".
  const previousIdsRef = useRef<Set<string> | null>(null);
  const [arrivals, setArrivals] = useState({ count: 0, version: 0 });
  useEffect(() => {
    if (!appointments) return;
    const previousIds = previousIdsRef.current;
    previousIdsRef.current = new Set(appointments.map((appointment) => appointment.id));
    if (!previousIds) return;
    const count = appointments.filter((appointment) => !previousIds.has(appointment.id)).length;
    if (count > 0) setArrivals((current) => ({ count, version: current.version + 1 }));
  }, [appointments]);

  const seenSet = new Set(seen);
  const list = appointments ?? [];
  const unreadIds = new Set(list.filter((appointment) => !seenSet.has(appointment.id)).map((appointment) => appointment.id));

  const markRead = useCallback((id: string) => {
    const current = readSeen();
    if (!current.includes(id)) writeSeen([...current, id]);
  }, []);

  const markAllRead = useCallback(() => {
    const current = readSeen();
    const missing = (appointments ?? []).map((appointment) => appointment.id).filter((id) => !current.includes(id));
    if (missing.length > 0) writeSeen([...current, ...missing]);
  }, [appointments]);

  return {
    count: unreadIds.size,
    unreadIds,
    arrivals,
    appointments: list,
    isLoading: appointmentsQuery.isLoading,
    isError: appointmentsQuery.isError,
    markRead,
    markAllRead,
  };
}
