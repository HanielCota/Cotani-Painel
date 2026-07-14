"use client";

import { Clock3Icon } from "lucide-react";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointments } from "@/hooks/use-appointments";
import { formatClinicDateTimeInput } from "@/lib/timezone";

export const appointmentStatusLabel = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
} as const;

interface AgendaAppointmentsListProps {
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
}

export function AgendaAppointmentsList({ timeZone, minStartTime, canSchedule }: AgendaAppointmentsListProps) {
  const { data: appointments, isPending, isError } = useAppointments();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar os atendimentos</AlertTitle>
        <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
      </Alert>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <Empty className="min-h-48 border-0 bg-muted/30">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Clock3Icon /></EmptyMedia>
          <EmptyTitle>Nenhum atendimento futuro</EmptyTitle>
          <EmptyDescription>
            {canSchedule ? "Use o formulário acima para registrar o primeiro horário." : "Cadastre os itens necessários acima para começar."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col divide-y">
      {appointments.map((appointment) => {
        const startTime = new Date(appointment.startTime);
        const dateTime = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        }).format(startTime);

        return (
          <div key={appointment.id} className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{appointment.customerName}</p>
              <p className="text-sm text-muted-foreground">{appointment.serviceName} · {dateTime}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Badge variant={appointment.status === "CONFIRMED" ? "default" : "secondary"}>
                {appointmentStatusLabel[appointment.status]}
              </Badge>
              <RescheduleAppointmentDialog
                appointmentId={appointment.id}
                currentStartTime={formatClinicDateTimeInput(startTime, timeZone)}
                minStartTime={minStartTime}
              />
              <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
