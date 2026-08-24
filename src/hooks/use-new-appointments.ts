"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useUpcomingAppointments } from "@/hooks/use-upcoming-appointments";

export function useNewAppointments() {
  const appointmentsQuery = useUpcomingAppointments(10);
  const appointments = appointmentsQuery.data;
  const previousIdsRef = useRef<Set<string> | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!appointments) return;

    const currentIds = new Set(appointments.map((appointment) => appointment.id));
    const previousIds = previousIdsRef.current;

    if (previousIds !== null) {
      const newIds = appointments
        .map((appointment) => appointment.id)
        .filter((id) => !previousIds.has(id));

      setUnreadIds((currentUnreadIds) => {
        const nextUnreadIds = new Set(
          [...currentUnreadIds].filter((id) => currentIds.has(id)),
        );

        for (const id of newIds) {
          nextUnreadIds.add(id);
        }

        const didChange =
          nextUnreadIds.size !== currentUnreadIds.size ||
          [...nextUnreadIds].some((id) => !currentUnreadIds.has(id));

        if (!didChange) {
          return currentUnreadIds;
        }

        return nextUnreadIds;
      });
    }

    previousIdsRef.current = currentIds;
  }, [appointments]);

  const dismiss = useCallback(() => {
    setUnreadIds(new Set());
  }, []);

  return {
    hasNew: unreadIds.size > 0,
    count: unreadIds.size,
    appointments: appointments ?? [],
    isLoading: appointmentsQuery.isLoading,
    isError: appointmentsQuery.isError,
    dismiss,
  };
}
