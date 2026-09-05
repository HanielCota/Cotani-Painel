"use client";

import { useState } from "react";
import { Clock3Icon } from "lucide-react";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { EditAppointmentDialog } from "@/components/dashboard/edit-appointment-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useAppointments } from "@/hooks/use-appointments";
import { usePagination } from "@/hooks/use-pagination";
import { formatClinicDateKey, formatClinicDateTimeInput } from "@/lib/timezone";
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

type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "UPCOMING" | "HISTORY";

const periodFilters: Array<{ value: PeriodFilter; label: string }> = [
  { value: "ALL", label: "Todos os períodos" },
  { value: "TODAY", label: "Hoje" },
  { value: "WEEK", label: "Próximos 7 dias" },
  { value: "UPCOMING", label: "Todos os próximos" },
  { value: "HISTORY", label: "Últimos 30 dias" },
];

interface AgendaAppointmentsListProps {
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
  customers?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string; duration: number }>;
}

export function AgendaAppointmentsList({ timeZone, minStartTime, canSchedule, customers = [], services = [] }: AgendaAppointmentsListProps) {
  const { data: appointments, isPending, isError, refetch } = useAppointments();
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const now = new Date();
  const todayKey = formatClinicDateKey(now, timeZone);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const filteredAppointments = (appointments ?? []).filter((appointment) => {
    const startTime = new Date(appointment.startTime);
    const matchesStatus = statusFilter === "ALL" || appointment.status === statusFilter;
    const matchesPeriod = periodFilter === "ALL"
      ? true
      : periodFilter === "TODAY"
        ? formatClinicDateKey(startTime, timeZone) === todayKey
        : periodFilter === "WEEK"
          ? startTime >= now && startTime <= weekEnd
          : periodFilter === "UPCOMING"
            ? startTime >= now
            : startTime < now;
    return matchesStatus && matchesPeriod;
  });
  const pagination = usePagination(filteredAppointments);

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
        <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Verifique sua conexão. Nenhuma alteração foi realizada.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
        </AlertDescription>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por período">
        {periodFilters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={periodFilter === filter.value ? "default" : "outline"}
            aria-pressed={periodFilter === filter.value}
            onClick={() => {
              setPeriodFilter(filter.value);
              pagination.resetPage();
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        {filters.map((filter) => (
          <Button
            key={filter.status}
            type="button"
            size="sm"
            variant={statusFilter === filter.status ? "default" : "outline"}
            aria-pressed={statusFilter === filter.status}
            onClick={() => {
              setStatusFilter(filter.status);
              pagination.resetPage();
            }}
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
          {pagination.pageItems.map((appointment: AgendaAppointment) => {
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
                    canSchedule ? <EditAppointmentDialog appointment={appointment} customers={customers} services={services} currentStartTime={formatClinicDateTimeInput(startTime, timeZone)} minStartTime={minStartTime} /> : <RescheduleAppointmentDialog appointmentId={appointment.id} currentStartTime={formatClinicDateTimeInput(startTime, timeZone)} minStartTime={minStartTime} />
                  ) : null}
                  <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={filteredAppointments.length} onPageChange={pagination.setPage} itemLabel="atendimento" />
    </div>
  );
}
