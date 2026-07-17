import { CalendarX2Icon } from "lucide-react";

import { appointmentStatusLabel } from "@/components/dashboard/agenda-appointments-list";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import { getUpcomingAppointments } from "@/server/services/appointments";

interface UpcomingAppointmentsListProps {
  clinic: ClinicModel;
  limit?: number;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  PENDING: "secondary",
  COMPLETED: "outline",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

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

export async function UpcomingAppointmentsList({ clinic, limit = 10 }: UpcomingAppointmentsListProps) {
  const appointments = await getUpcomingAppointments(clinic, limit);

  if (appointments.length === 0) {
    return (
      <Empty className="min-h-32 border-0 bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarX2Icon /></EmptyMedia>
          <EmptyTitle>Sem agendamentos próximos</EmptyTitle>
          <EmptyDescription>Os próximos atendimentos confirmados e pendentes aparecerão aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col">
      {appointments.map((appointment) => {
        const dateTime = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: clinic.timeZone,
        }).format(appointment.startTime);

        return (
          <div
            key={appointment.id}
            className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md border bg-muted text-xs font-medium">
                <span>{appointment.startTime.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: clinic.timeZone })}</span>
                <span className="text-[10px] text-muted-foreground">
                  {appointment.startTime.toLocaleDateString("pt-BR", { month: "short", timeZone: clinic.timeZone })}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{appointment.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{appointment.serviceName} · {dateTime}</p>
              </div>
            </div>
            <Badge variant={statusVariant[appointment.status] ?? "secondary"}>
              {appointmentStatusLabel[appointment.status as keyof typeof appointmentStatusLabel]}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
