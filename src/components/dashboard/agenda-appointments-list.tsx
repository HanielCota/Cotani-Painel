"use client";

import { useState } from "react";
import { Clock3Icon } from "lucide-react";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointments } from "@/hooks/use-appointments";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import type { AgendaAppointment } from "@/types";

export const appointmentStatusLabel = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
} as const;

type AppointmentStatus = keyof typeof appointmentStatusLabel;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONFIRMED: "default",
  PENDING: "secondary",
  COMPLETED: "outline",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

const filters: Array<{ status: AppointmentStatus | "ALL"; label: string }> = [
  { status: "ALL", label: "Todos" },
  { status: "PENDING", label: "Pendentes" },
  { status: "CONFIRMED", label: "Confirmados" },
  { status: "COMPLETED", label: "Concluídos" },
  { status: "CANCELED", label: "Cancelados" },
  { status: "NO_SHOW", label: "Faltas" },
];

interface AgendaAppointmentsListProps {
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
}

export function AgendaAppointmentsList({ timeZone, minStartTime, canSchedule }: AgendaAppointmentsListProps) {
  const { data: appointments, isPending, isError } = useAppointments();
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");

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
      <Empty className="min-h-48 border border-dashed border-border/80 bg-background/50">
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

  const filteredAppointments =
    statusFilter === "ALL"
      ? appointments
      : appointments.filter((appointment) => appointment.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        {filters.map((filter) => (
          <Button
            key={filter.status}
            type="button"
            size="sm"
            variant={statusFilter === filter.status ? "default" : "outline"}
            onClick={() => setStatusFilter(filter.status)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredAppointments.length === 0 ? (
        <Empty className="min-h-32 border border-dashed border-border/80 bg-background/50">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Clock3Icon /></EmptyMedia>
            <EmptyTitle>Nenhum atendimento neste filtro</EmptyTitle>
            <EmptyDescription>Tente selecionar outro status para visualizar os atendimentos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col divide-y">
          {filteredAppointments.map((appointment: AgendaAppointment) => {
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
                    <p className="text-sm text-muted-foreground">
                      {appointment.serviceName}
                      {appointment.professionalName ? ` · ${appointment.professionalName}` : ""} · {dateTime}
                    </p>
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
      )}
    </div>
  );
}
