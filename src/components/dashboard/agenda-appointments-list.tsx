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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  PENDING: "secondary",
  COMPLETED: "outline",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

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
          <div
            key={appointment.id}
            className="flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border bg-muted text-xs font-medium">
                <span>{startTime.toLocaleDateString("pt-BR", { day: "2-digit", timeZone })}</span>
                <span className="text-[10px] text-muted-foreground">
                  {startTime.toLocaleDateString("pt-BR", { month: "short", timeZone })}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-medium">{appointment.customerName}</p>
                <p className="text-sm text-muted-foreground">{appointment.serviceName} · {dateTime}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Badge variant={statusVariant[appointment.status] ?? "secondary"}>
                {appointmentStatusLabel[appointment.status]}
              </Badge>
              {appointment.status !== "CANCELED" && appointment.status !== "NO_SHOW" && appointment.status !== "COMPLETED" ? (
                <RescheduleAppointmentDialog
                  appointmentId={appointment.id}
                  currentStartTime={formatClinicDateTimeInput(startTime, timeZone)}
                  minStartTime={minStartTime}
                />
              ) : null}
              <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
