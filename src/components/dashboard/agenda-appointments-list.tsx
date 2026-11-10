"use client";

import { useState } from "react";

import { parsePageNumber } from "@/lib/page-number";
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

type StatusFilter = AppointmentStatus | "ALL";

type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "UPCOMING" | "HISTORY";

type FilterOption<Value extends string> = { value: Value; label: string };

const statusFilters: Array<FilterOption<StatusFilter>> = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "COMPLETED", label: "Concluídos" },
  { value: "CANCELED", label: "Cancelados" },
  { value: "NO_SHOW", label: "Faltas" },
];

const periodFilters: Array<FilterOption<PeriodFilter>> = [
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

type ScheduleOptions = Required<AgendaAppointmentsListProps>;

function readFilterFromUrl<Value extends string>(name: string, options: Array<FilterOption<Value>>): Value {
  const value = readUrlSearchParam(name, "ALL");
  const option = options.find((item) => item.value === value);
  return option ? option.value : ("ALL" as Value);
}

function urlFilterValue(value: string) {
  return value === "ALL" ? null : value;
}

function useAppointmentListFilters() {
  const [page, setPageState] = useState(() => parsePageNumber(readUrlSearchParam("pagina", "1")));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => readFilterFromUrl("status", statusFilters));
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(() => readFilterFromUrl("periodo", periodFilters));

  function setPage(nextPage: number) {
    setPageState(nextPage);
    replaceUrlSearchParams({ pagina: nextPage > 1 ? String(nextPage) : null });
  }

  function changePeriod(value: PeriodFilter) {
    setPeriodFilter(value);
    replaceUrlSearchParams({ periodo: urlFilterValue(value), pagina: null });
    setPage(1);
  }

  function changeStatus(value: StatusFilter) {
    setStatusFilter(value);
    replaceUrlSearchParams({ status: urlFilterValue(value), pagina: null });
    setPage(1);
  }

  return { page, statusFilter, periodFilter, setPage, changePeriod, changeStatus };
}

export function AgendaAppointmentsList({
  timeZone,
  minStartTime,
  canSchedule,
  customers = [],
  services = [],
}: AgendaAppointmentsListProps) {
  const filters = useAppointmentListFilters();
  const { data, isPending, isError, isFetching, refetch } = useAppointments({
    page: filters.page,
    status: filters.statusFilter,
    period: filters.periodFilter,
  });
  const appointments = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 15)));
  const scheduleOptions: ScheduleOptions = { timeZone, minStartTime, canSchedule, customers, services };

  if (isPending) return <AppointmentsLoading />;
  if (isError) return <AppointmentsLoadError onRetry={() => void refetch()} />;
  if ((data?.total ?? 0) === 0 && filters.statusFilter === "ALL" && filters.periodFilter === "ALL") {
    return <NoAppointmentsEmpty canSchedule={canSchedule} />;
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={isFetching}>
      <FilterButtonGroup label="Filtrar por período" options={periodFilters} current={filters.periodFilter} onSelect={filters.changePeriod} />
      <FilterButtonGroup label="Filtrar por status" options={statusFilters} current={filters.statusFilter} onSelect={filters.changeStatus} />

      {appointments.length === 0 ? (
        <NoFilteredAppointmentsEmpty />
      ) : (
        <div className="flex flex-col divide-y">
          {appointments.map((appointment: AgendaAppointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} scheduleOptions={scheduleOptions} />
          ))}
        </div>
      )}
      <PaginationControls
        page={data?.page ?? filters.page}
        pageCount={pageCount}
        totalItems={data?.total ?? 0}
        onPageChange={filters.setPage}
        itemLabelPlural="atendimentos"
      />
    </div>
  );
}

function AppointmentsLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function AppointmentsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar os atendimentos</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>Verifique sua conexão. Nenhuma alteração foi realizada.</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function NoAppointmentsEmpty({ canSchedule }: { canSchedule: boolean }) {
  return (
    <Empty className="min-h-48 border border-dashed border-border/80 bg-background/50">
      <EmptyHeader>
        <EmptyMascot />
        <EmptyTitle>Nenhum atendimento futuro</EmptyTitle>
        <EmptyDescription>
          {canSchedule
            ? "Use o formulário acima para registrar o primeiro horário."
            : "Cadastre os itens necessários acima para começar."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function NoFilteredAppointmentsEmpty() {
  return (
    <Empty className="min-h-32 border border-dashed border-border/80 bg-background/50">
      <EmptyHeader>
        <EmptyMascot />
        <EmptyTitle>Nenhum atendimento neste filtro</EmptyTitle>
        <EmptyDescription>Tente selecionar outro status para visualizar os atendimentos.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

interface FilterButtonGroupProps<Value extends string> {
  label: string;
  options: Array<FilterOption<Value>>;
  current: Value;
  onSelect: (value: Value) => void;
}

function FilterButtonGroup<Value extends string>({ label, options, current, onSelect }: FilterButtonGroupProps<Value>) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((filter) => (
        <Button
          key={filter.value}
          type="button"
          size="sm"
          variant={current === filter.value ? "default" : "outline"}
          aria-pressed={current === filter.value}
          onClick={() => onSelect(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}

function formatAppointmentDateTime(startTime: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(startTime);
}

function AppointmentRow({ appointment, scheduleOptions }: { appointment: AgendaAppointment; scheduleOptions: ScheduleOptions }) {
  const { timeZone } = scheduleOptions;
  const startTime = new Date(appointment.startTime);
  const dateTime = formatAppointmentDateTime(startTime, timeZone);

  return (
    <div className="flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
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
        <AppointmentScheduleAction appointment={appointment} startTime={startTime} scheduleOptions={scheduleOptions} />
        <AppointmentActions
          appointmentId={appointment.id}
          status={appointment.status}
          startTime={appointment.startTime}
        />
      </div>
    </div>
  );
}

function isClosedStatus(status: AgendaAppointment["status"]) {
  return status === "CANCELED" || status === "NO_SHOW" || status === "COMPLETED";
}

interface AppointmentScheduleActionProps {
  appointment: AgendaAppointment;
  startTime: Date;
  scheduleOptions: ScheduleOptions;
}

function AppointmentScheduleAction({ appointment, startTime, scheduleOptions }: AppointmentScheduleActionProps) {
  const { timeZone, minStartTime, canSchedule, customers, services } = scheduleOptions;
  if (isClosedStatus(appointment.status)) return null;

  const currentStartTime = formatClinicDateTimeInput(startTime, timeZone);
  if (canSchedule) {
    return (
      <EditAppointmentDialog
        appointment={appointment}
        customers={customers}
        services={services}
        currentStartTime={currentStartTime}
        minStartTime={minStartTime}
      />
    );
  }

  return (
    <RescheduleAppointmentDialog
      appointmentId={appointment.id}
      currentStartTime={currentStartTime}
      minStartTime={minStartTime}
    />
  );
}
