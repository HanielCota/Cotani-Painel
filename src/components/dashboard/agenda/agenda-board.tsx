"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, RowsIcon } from "lucide-react";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import {
  buildDayColumns,
  buildWeekColumns,
  hhmm,
  itemMinuteSpans,
  itemsOnDate,
  periodTitle,
  visibleSortedItems,
} from "@/components/dashboard/agenda/agenda-board-helpers";
import { AgendaMobileList } from "@/components/dashboard/agenda/agenda-mobile-list";
import { AgendaTimeGrid, type AgendaGridColumn } from "@/components/dashboard/agenda/agenda-time-grid";
import { AppointmentDetailsDialog } from "@/components/dashboard/agenda/appointment-details-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointmentsRange } from "@/hooks/use-appointments-range";
import { gridBounds, localDateAndMinutes } from "@/lib/agenda-layout";
import { replaceUrlSearchParams } from "@/lib/browser-url";
import { addDaysToDateKey, isDateKey, startOfWeekDateKey, weekdayOfDateKey } from "@/lib/timezone";
import type { AgendaAppointment } from "@/types";

type AgendaView = "dia" | "semana" | "lista";

const VIEWS: Array<{ value: AgendaView; label: string; icon: typeof ListIcon }> = [
  { value: "dia", label: "Dia", icon: RowsIcon },
  { value: "semana", label: "Semana", icon: CalendarDaysIcon },
  { value: "lista", label: "Lista", icon: ListIcon },
];

interface AgendaSchedulingProps {
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
}

interface AgendaBoardProps extends AgendaSchedulingProps {
  /** Hoje (YYYY-MM-DD) no fuso do negócio, calculado no servidor. */
  today: string;
  /** Visão e data iniciais vindas da URL (lidas no servidor para evitar divergência de hidratação). */
  initialView?: string;
  initialDate?: string;
}

type ClinicNow = { dateKey: string; minutes: number };

/**
 * Data e minuto atuais no fuso do negócio. Começa sem minuto (sem linha de
 * "agora") para o HTML do servidor e o do navegador coincidirem; atualiza ao
 * montar e a cada minuto.
 */
function useClinicNow(timeZone: string, today: string) {
  const [now, setNow] = useState({ dateKey: today, minutes: -1 });
  useEffect(() => {
    const update = () => setNow(localDateAndMinutes(new Date().toISOString(), timeZone));
    queueMicrotask(update);
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  return now;
}

function parseView(initialView: string | undefined): AgendaView {
  const match = VIEWS.find((item) => item.value === initialView);
  return match ? match.value : "dia";
}

interface AgendaPeriodInput {
  today: string;
  todayDateKey: string;
  initialView?: string;
  initialDate?: string;
}

function useAgendaPeriod({ today, todayDateKey, initialView, initialDate }: AgendaPeriodInput) {
  const [view, setView] = useState<AgendaView>(() => parseView(initialView));
  const [anchor, setAnchor] = useState(() => (isDateKey(initialDate) ? initialDate : today));

  function changeView(next: AgendaView) {
    setView(next);
    replaceUrlSearchParams({ visao: next === "dia" ? null : next, pagina: null });
  }

  function changeAnchor(next: string) {
    setAnchor(next);
    replaceUrlSearchParams({ data: next === todayDateKey ? null : next });
  }

  const isWeek = view === "semana";
  const from = isWeek ? startOfWeekDateKey(anchor) : anchor;
  const days = isWeek ? 7 : 1;
  const step = isWeek ? 7 : 1;

  return { view, anchor, isWeek, from, days, step, changeView, changeAnchor };
}

type AgendaPeriod = ReturnType<typeof useAgendaPeriod>;

interface AgendaRangeInput {
  period: AgendaPeriod;
  showCanceled: boolean;
  timeZone: string;
  todayDateKey: string;
}

function useAgendaRangeData({ period, showCanceled, timeZone, todayDateKey }: AgendaRangeInput) {
  const { from, days, isWeek, anchor } = period;
  const { data, isPending, isError, isFetching, refetch } = useAppointmentsRange({ from, days });

  const items = useMemo(() => visibleSortedItems(data?.items ?? [], showCanceled), [data?.items, showCanceled]);
  const dateKeys = useMemo(() => Array.from({ length: days }, (_, index) => addDaysToDateKey(from, index)), [from, days]);
  const columns = useMemo<AgendaGridColumn[]>(
    () => (isWeek
      ? buildWeekColumns(dateKeys, items, timeZone, todayDateKey)
      : buildDayColumns(itemsOnDate(items, anchor, timeZone), data?.professionals ?? [], anchor)),
    [items, isWeek, dateKeys, anchor, data?.professionals, todayDateKey, timeZone],
  );
  const bounds = useMemo(
    () => gridBounds(data?.hours ?? [], dateKeys.map(weekdayOfDateKey), itemMinuteSpans(items, timeZone)),
    [data?.hours, dateKeys, items, timeZone],
  );

  return { isPending, isError, isFetching, refetch, items, dateKeys, columns, bounds };
}

type AgendaRangeData = ReturnType<typeof useAgendaRangeData>;

/** Agenda: visões Dia (colunas por profissional), Semana (colunas por dia) e Lista. */
export function AgendaBoard({ today, initialView, initialDate, ...scheduling }: AgendaBoardProps) {
  const { timeZone, canSchedule } = scheduling;
  const now = useClinicNow(timeZone, today);
  const period = useAgendaPeriod({ today, todayDateKey: now.dateKey, initialView, initialDate });
  const [showCanceled, setShowCanceled] = useState(false);
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const rangeData = useAgendaRangeData({ period, showCanceled, timeZone, todayDateKey: now.dateKey });

  const selectSlot = canSchedule ? (dateKey: string, minutes: number) => setNewSlot(`${dateKey}T${hhmm(minutes)}`) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra: visão + navegação */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AgendaViewSwitcher view={period.view} onChange={period.changeView} />
        {period.view !== "lista" ? <AgendaPeriodNavigation period={period} todayDateKey={now.dateKey} /> : null}
      </div>

      <AgendaContent
        view={period.view}
        isWeek={period.isWeek}
        scheduling={scheduling}
        rangeData={rangeData}
        now={now}
        showCanceled={showCanceled}
        onShowCanceledChange={setShowCanceled}
        onSelectItem={setSelected}
        onSelectSlot={selectSlot}
      />

      <AgendaDialogs scheduling={scheduling} selected={selected} onCloseDetails={() => setSelected(null)} newSlot={newSlot} onCloseNewSlot={() => setNewSlot(null)} />
    </div>
  );
}

function AgendaViewSwitcher({ view, onChange }: { view: AgendaView; onChange: (next: AgendaView) => void }) {
  return (
    <div className="inline-flex w-fit rounded-lg border border-border/80 bg-muted/40 p-0.5" role="group" aria-label="Visão da agenda">
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={view === value ? "default" : "ghost"}
          aria-pressed={view === value}
          onClick={() => onChange(value)}
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
      ))}
    </div>
  );
}

function AgendaPeriodNavigation({ period, todayDateKey }: { period: AgendaPeriod; todayDateKey: string }) {
  const { isWeek, anchor, from, step, changeAnchor } = period;
  const isCurrentPeriod = isWeek ? startOfWeekDateKey(todayDateKey) === from : anchor === todayDateKey;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="icon-sm" aria-label={isWeek ? "Semana anterior" : "Dia anterior"} onClick={() => changeAnchor(addDaysToDateKey(anchor, -step))}><ChevronLeftIcon /></Button>
      <Button type="button" variant="outline" size="sm" disabled={isCurrentPeriod} onClick={() => changeAnchor(todayDateKey)}>Hoje</Button>
      <Button type="button" variant="outline" size="icon-sm" aria-label={isWeek ? "Próxima semana" : "Próximo dia"} onClick={() => changeAnchor(addDaysToDateKey(anchor, step))}><ChevronRightIcon /></Button>
      <h2 className="min-w-0 text-sm font-semibold first-letter:uppercase sm:text-base" aria-live="polite">{periodTitle(isWeek, from, anchor)}</h2>
    </div>
  );
}

interface AgendaContentProps {
  view: AgendaView;
  isWeek: boolean;
  scheduling: AgendaSchedulingProps;
  rangeData: AgendaRangeData;
  now: ClinicNow;
  showCanceled: boolean;
  onShowCanceledChange: (showCanceled: boolean) => void;
  onSelectItem: (appointment: AgendaAppointment) => void;
  onSelectSlot: ((dateKey: string, minutes: number) => void) | undefined;
}

function AgendaContent({ view, scheduling, rangeData, ...rangeViewProps }: AgendaContentProps) {
  if (view === "lista") {
    return <AgendaAppointmentsList timeZone={scheduling.timeZone} minStartTime={scheduling.minStartTime} canSchedule={scheduling.canSchedule} customers={scheduling.customers} services={scheduling.services} />;
  }
  if (rangeData.isPending) return <Skeleton className="h-96 rounded-xl" />;
  if (rangeData.isError) return <AgendaLoadError onRetry={() => void rangeData.refetch()} />;

  return <AgendaRangeView rangeData={rangeData} timeZone={scheduling.timeZone} {...rangeViewProps} />;
}

function AgendaLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        Não foi possível carregar a agenda.
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>
      </AlertDescription>
    </Alert>
  );
}

type AgendaRangeViewProps = Omit<AgendaContentProps, "view" | "scheduling"> & { timeZone: string };

function AgendaRangeView({ rangeData, timeZone, isWeek, now, showCanceled, onShowCanceledChange, onSelectItem, onSelectSlot }: AgendaRangeViewProps) {
  return (
    <div className="flex flex-col gap-3" aria-busy={rangeData.isFetching}>
      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={showCanceled} onCheckedChange={(checked) => onShowCanceledChange(Boolean(checked))} />
        Mostrar cancelados
      </label>

      {/* Grade (tablet e desktop) */}
      <div className="hidden md:block">
        <AgendaTimeGrid
          columns={rangeData.columns}
          timeZone={timeZone}
          gridStart={rangeData.bounds.start}
          gridEnd={rangeData.bounds.end}
          now={now}
          onSelectItem={onSelectItem}
          onSelectSlot={onSelectSlot}
        />
      </div>

      <AgendaMobileList
        dateKeys={rangeData.dateKeys}
        items={rangeData.items}
        timeZone={timeZone}
        isWeek={isWeek}
        todayDateKey={now.dateKey}
        onSelectItem={onSelectItem}
      />
    </div>
  );
}

interface AgendaDialogsProps {
  scheduling: AgendaSchedulingProps;
  selected: AgendaAppointment | null;
  onCloseDetails: () => void;
  newSlot: string | null;
  onCloseNewSlot: () => void;
}

function AgendaDialogs({ scheduling, selected, onCloseDetails, newSlot, onCloseNewSlot }: AgendaDialogsProps) {
  const { timeZone, minStartTime, canSchedule, customers, services } = scheduling;

  return (
    <>
      <AppointmentDetailsDialog
        appointment={selected}
        onOpenChange={(open) => { if (!open) onCloseDetails(); }}
        timeZone={timeZone}
        minStartTime={minStartTime}
        canSchedule={canSchedule}
        customers={customers}
        services={services}
      />

      {canSchedule ? (
        <AppointmentFormDialog
          open={newSlot !== null}
          onOpenChange={(open) => { if (!open) onCloseNewSlot(); }}
          customers={customers}
          services={services}
          minStartTime={minStartTime}
          timeZone={timeZone}
          initialStartTime={newSlot ?? undefined}
        />
      ) : null}
    </>
  );
}
