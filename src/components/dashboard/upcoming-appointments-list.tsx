"use client";


import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMascot, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingAppointments } from "@/hooks/use-upcoming-appointments";

export function UpcomingAppointmentsListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

interface UpcomingAppointmentsListProps {
  timeZone: string;
  limit?: number;
}

export function UpcomingAppointmentsList({ timeZone, limit = 10 }: UpcomingAppointmentsListProps) {
  const { data: appointments, isLoading } = useUpcomingAppointments(limit);

  if (isLoading) {
    return <UpcomingAppointmentsListSkeleton />;
  }

  if (!appointments || appointments.length === 0) {
    return (
      <Empty className="min-h-40 border border-dashed border-border/80 bg-background/50">
        <EmptyHeader>
          <EmptyMascot />
          <EmptyTitle>Sem agendamentos próximos</EmptyTitle>
          <EmptyDescription>Os próximos atendimentos confirmados e pendentes aparecerão aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col">
      {appointments.map((appointment) => {
        const startTime = new Date(appointment.startTime);
        const dateTime = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone,
        }).format(startTime);

        return (
          <div
            key={appointment.id}
            className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md border bg-muted text-xs font-medium">
                <span>{startTime.toLocaleDateString("pt-BR", { day: "2-digit", timeZone })}</span>
                <span className="text-xs text-muted-foreground">
                  {startTime.toLocaleDateString("pt-BR", { month: "short", timeZone })}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{appointment.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{appointment.serviceName} · {dateTime}</p>
              </div>
            </div>
            <Badge variant={appointmentStatusBadgeVariant(appointment.status)} className="w-fit">
              {appointmentStatusLabel(appointment.status)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
