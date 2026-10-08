"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, CalendarDaysIcon, CheckCheckIcon } from "lucide-react";
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
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useNewAppointments } from "@/hooks/use-new-appointments";
import { cn } from "@/lib/utils";

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

function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}

/** Item "Notificações" da sidebar: próximos agendamentos, com contador de não lidos. */
export function NotificationBell() {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const { count, unreadIds, arrivals, appointments, isLoading, isError, markRead, markAllRead } = useNewAppointments();

  const openAgenda = useCallback(() => {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    router.push("/dashboard/agenda");
  }, [isMobile, router, setOpenMobile]);

  useEffect(() => {
    if (arrivals.count === 0) return;
    toast.info(`${arrivals.count} novo${arrivals.count === 1 ? " agendamento" : "s agendamentos"} recebido${arrivals.count === 1 ? "" : "s"}.`, {
      description: "Verifique a agenda para mais detalhes.",
      action: { label: "Ver", onClick: openAgenda },
    });
  }, [arrivals, openAgenda]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<SidebarMenuButton tooltip={count > 0 ? `Notificações (${badgeText(count)})` : "Notificações"} className="relative h-9" />}
        aria-label={count > 0 ? `Notificações, ${count} não lida${count === 1 ? "" : "s"}` : "Notificações"}
      >
        <BellIcon />
        <span className="truncate">Notificações</span>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground",
              // Recolhida: vira uma bolinha sobre o ícone.
              "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-right-1 group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:text-[10px]",
            )}
          >
            {badgeText(count)}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        side={isMobile ? "top" : "right"}
        align="end"
        sideOffset={12}
        className="w-[26rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <PopoverHeader className="flex-row items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <PopoverTitle>Notificações</PopoverTitle>
            <PopoverDescription>{count > 0 ? `${count} não lida${count === 1 ? "" : "s"} · próximos agendamentos` : "Próximos agendamentos do seu negócio."}</PopoverDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={markAllRead} disabled={count === 0} className="shrink-0">
            <CheckCheckIcon data-icon="inline-start" />
            Marcar todas como lidas
          </Button>
        </PopoverHeader>

        <div className="max-h-[min(30rem,60svh)] overflow-y-auto overscroll-contain p-2">
          {isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Carregando agendamentos...</p>
          ) : isError ? (
            <p className="px-2 py-6 text-center text-sm text-destructive">Não foi possível carregar os agendamentos.</p>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <CalendarDaysIcon className="size-6" />
              <p className="text-sm">Nenhum próximo agendamento.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {appointments.map((appointment) => {
                const unread = unreadIds.has(appointment.id);
                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markRead(appointment.id);
                        openAgenda();
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        unread && "bg-accent/50",
                      )}
                    >
                      <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn("truncate text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>{appointment.customerName}</span>
                        <span className="truncate text-xs text-muted-foreground">{appointment.serviceName}</span>
                        <span className="text-xs font-medium text-primary">{formatAppointmentDate(appointment.startTime)}</span>
                      </span>
                      {unread ? <span className="sr-only">Não lida</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
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
