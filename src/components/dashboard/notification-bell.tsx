"use client";

import { useEffect } from "react";
import { BellIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useNewAppointments } from "@/hooks/use-new-appointments";

export function NotificationBell() {
  const { hasNew, count, dismiss } = useNewAppointments();

  useEffect(() => {
    if (!hasNew) return;

    toast.info(`${count} novo${count === 1 ? " agendamento" : "s agendamentos"} recebido${count === 1 ? "" : "s"}.`, {
      description: "Verifique a agenda para mais detalhes.",
      action: {
        label: "Ver",
        onClick: () => {
          window.location.href = "/dashboard/agenda";
        },
      },
      onDismiss: dismiss,
    });
  }, [hasNew, count, dismiss]);

  return (
    <Button type="button" variant="ghost" size="icon" className="relative size-9" aria-label="Notificações">
      <BellIcon className="size-5" />
      {count > 0 ? (
        <span className="absolute right-1.5 top-1.5 flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      ) : null}
    </Button>
  );
}
