"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, CalendarDaysIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNewAppointments } from "@/hooks/use-new-appointments";

const appointmentDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatAppointmentDate(startTime: Date) {
  return appointmentDateFormatter.format(new Date(startTime));
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { hasNew, count, appointments, isLoading, isError, dismiss } = useNewAppointments();

  const openAgenda = useCallback(() => {
    setOpen(false);
    dismiss();
    router.push("/dashboard/agenda");
  }, [dismiss, router]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      dismiss();
    }
  }

  useEffect(() => {
    if (!hasNew) return;

    toast.info(`${count} novo${count === 1 ? " agendamento" : "s agendamentos"} recebido${count === 1 ? "" : "s"}.`, {
      description: "Verifique a agenda para mais detalhes.",
      action: {
        label: "Ver",
        onClick: openAgenda,
      },
    });
  }, [hasNew, count, openAgenda]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={count > 0 ? `Notificações, ${count} nova${count === 1 ? "" : "s"}` : "Notificações"}
          />
        }
      >
        <BellIcon className="size-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <PopoverHeader className="border-b border-border/60 px-4 py-3">
          <PopoverTitle>Notificações</PopoverTitle>
          <PopoverDescription>Próximos agendamentos do seu negócio.</PopoverDescription>
        </PopoverHeader>

        <div className="max-h-80 overflow-y-auto p-2">
          {isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Carregando agendamentos...</p>
          ) : isError ? (
            <p className="px-2 py-6 text-center text-sm text-destructive">Não foi possível carregar os agendamentos.</p>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
              <CalendarDaysIcon className="size-6" />
              <p className="text-sm">Nenhum próximo agendamento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {appointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={openAgenda}
                  className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-sm font-medium text-foreground">{appointment.customerName}</span>
                  <span className="truncate text-xs text-muted-foreground">{appointment.serviceName}</span>
                  <span className="text-xs font-medium text-primary">{formatAppointmentDate(appointment.startTime)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 p-2">
          <Button type="button" variant="ghost" className="w-full justify-center" onClick={openAgenda}>
            <CalendarDaysIcon className="size-4" />
            Abrir agenda
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
