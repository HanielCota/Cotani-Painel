"use client";

import { useState } from "react";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { EditAppointmentDialog } from "@/components/dashboard/edit-appointment-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMascot, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useAppointments } from "@/hooks/use-appointments";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import type { AgendaAppointment } from "@/types";
import { readUrlSearchParam, replaceUrlSearchParams } from "@/lib/browser-url";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

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
  const [page, setPageState] = useState(() => Math.max(1, Number.parseInt(readUrlSearchParam("pagina", "1"), 10) || 1));
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">(() => {
    const value = readUrlSearchParam("status", "ALL");
    return filters.some((item) => item.status === value) ? value as AppointmentStatus | "ALL" : "ALL";
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(() => {
    const value = readUrlSearchParam("periodo", "ALL");
    return periodFilters.some((item) => item.value === value) ? value as PeriodFilter : "ALL";
  });
  function setPage(nextPage: number) {
    setPageState(nextPage);
    replaceUrlSearchParams({ pagina: nextPage > 1 ? String(nextPage) : null });
  }
  const { data, isPending, isError, isFetching, refetch } = useAppointments({ page, status: statusFilter, period: periodFilter });
  const appointments = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 15)));

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

  if ((data?.total ?? 0) === 0 && statusFilter === "ALL" && periodFilter === "ALL") {
    return (
      <Empty className="min-h-48 border border-dashed border-border/80 bg-background/50">
        <EmptyHeader>
          <EmptyMascot />
          <EmptyTitle>Nenhum atendimento futuro</EmptyTitle>
          <EmptyDescription>
            {canSchedule ? "Use o formulário acima para registrar o primeiro horário." : "Cadastre os itens necessários acima para começar."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={isFetching}>
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
              replaceUrlSearchParams({ periodo: filter.value === "ALL" ? null : filter.value, pagina: null });
              setPage(1);
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
              replaceUrlSearchParams({ status: filter.status === "ALL" ? null : filter.status, pagina: null });
              setPage(1);
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {appointments.length === 0 ? (
        <Empty className="min-h-32 border border-dashed border-border/80 bg-background/50">
          <EmptyHeader>
            <EmptyMascot />
            <EmptyTitle>Nenhum atendimento neste filtro</EmptyTitle>
            <EmptyDescription>Tente selecionar outro status para visualizar os atendimentos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col divide-y">
          {appointments.map((appointment: AgendaAppointment) => {
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
                    <span className="text-xs text-muted-foreground">
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
                  <Badge variant={appointmentStatusBadgeVariant(appointment.status)}>
                    {appointmentStatusLabel(appointment.status)}
                  </Badge>
                  {appointment.status !== "CANCELED" && appointment.status !== "NO_SHOW" && appointment.status !== "COMPLETED" ? (
                    canSchedule ? <EditAppointmentDialog appointment={appointment} customers={customers} services={services} currentStartTime={formatClinicDateTimeInput(startTime, timeZone)} minStartTime={minStartTime} /> : <RescheduleAppointmentDialog appointmentId={appointment.id} currentStartTime={formatClinicDateTimeInput(startTime, timeZone)} minStartTime={minStartTime} />
                  ) : null}
                  <AppointmentActions appointmentId={appointment.id} status={appointment.status} startTime={appointment.startTime} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PaginationControls page={data?.page ?? page} pageCount={pageCount} totalItems={data?.total ?? 0} onPageChange={setPage} itemLabelPlural="atendimentos" />
    </div>
  );
}
