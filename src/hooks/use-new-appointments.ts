"use client";

import { useEffect, useRef, useState } from "react";

import { useUpcomingAppointments } from "@/hooks/use-upcoming-appointments";

export function useNewAppointments() {
  const { data: appointments } = useUpcomingAppointments(10);
  const [hasNew, setHasNew] = useState(false);
  const previousCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!appointments) return;

    const currentCount = appointments.length;
    const previousCount = previousCountRef.current;

    if (previousCount !== null && currentCount > previousCount) {
      setHasNew(true);
    }

    previousCountRef.current = currentCount;
  }, [appointments]);

  function dismiss() {
    setHasNew(false);
  }

  return { hasNew, count: appointments?.length ?? 0, dismiss };
}
