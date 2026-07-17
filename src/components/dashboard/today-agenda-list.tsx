import { CalendarX2Icon } from "lucide-react";

import { appointmentStatusLabel } from "@/components/dashboard/agenda-appointments-list";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import { getTodayAppointments } from "@/server/services/appointments";

interface TodayAgendaListProps {
  clinic: ClinicModel;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  PENDING: "secondary",
  COMPLETED: "outline",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

export function TodayAgendaListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-10 rounded-md" />
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

export async function TodayAgendaList({ clinic }: TodayAgendaListProps) {
  const appointments = await getTodayAppointments(clinic);

  if (appointments.length === 0) {
    return (
      <Empty className="min-h-32 border-0 bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarX2Icon /></EmptyMedia>
          <EmptyTitle>Nenhum atendimento hoje</EmptyTitle>
          <EmptyDescription>Os atendimentos confirmados e pendentes do dia aparecerão aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col">
      {appointments.map((appointment) => {
        const time = new Intl.DateTimeFormat("pt-BR", {
          timeStyle: "short",
          timeZone: clinic.timeZone,
        }).format(appointment.startTime);

        return (
          <div
            key={appointment.id}
            className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-5 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium">
                {time}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{appointment.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{appointment.serviceName}</p>
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
