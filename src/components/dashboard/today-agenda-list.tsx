"use client";

import { CalendarX2Icon } from "lucide-react";

import { appointmentStatusLabel } from "@/components/dashboard/agenda-appointments-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointments } from "@/hooks/use-appointments";
import { getClinicDateBounds } from "@/lib/timezone";

interface TodayAgendaListProps {
  timeZone: string;
}

export function TodayAgendaList({ timeZone }: TodayAgendaListProps) {
  const { data: appointments, isPending, isError } = useAppointments();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar a agenda de hoje</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
      </Alert>
    );
  }

  const { startOfToday, startOfTomorrow } = getClinicDateBounds(timeZone);
  const todayAppointments = (appointments ?? []).filter((appointment) => {
    const startTime = new Date(appointment.startTime);

    return startTime >= startOfToday && startTime < startOfTomorrow;
  });

  if (todayAppointments.length === 0) {
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
    <div className="flex flex-col divide-y">
      {todayAppointments.map((appointment) => {
        const time = new Intl.DateTimeFormat("pt-BR", {
          timeStyle: "short",
          timeZone,
        }).format(new Date(appointment.startTime));

        return (
          <div key={appointment.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{appointment.customerName}</p>
              <p className="text-sm text-muted-foreground">{appointment.serviceName} · {time}</p>
            </div>
            <Badge variant={appointment.status === "CONFIRMED" ? "default" : "secondary"}>
              {appointmentStatusLabel[appointment.status]}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
