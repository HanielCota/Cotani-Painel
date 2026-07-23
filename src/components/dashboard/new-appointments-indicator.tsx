"use client";

import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNewAppointments } from "@/hooks/use-new-appointments";

export function NewAppointmentsIndicator() {
  const { hasNew, count, dismiss } = useNewAppointments();

  if (!hasNew) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1.5 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
      onClick={dismiss}
    >
      <BellIcon className="size-3.5" />
      <span className="text-xs">{count} agendamento{count === 1 ? "" : "s"}</span>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
      </span>
    </Button>
  );
}
