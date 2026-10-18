"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, RowsIcon } from "lucide-react";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import { AgendaTimeGrid, type AgendaGridColumn } from "@/components/dashboard/agenda/agenda-time-grid";
import { AppointmentDetailsDialog } from "@/components/dashboard/agenda/appointment-details-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointmentsRange } from "@/hooks/use-appointments-range";
import { gridBounds, localDateAndMinutes } from "@/lib/agenda-layout";
import { replaceUrlSearchParams } from "@/lib/browser-url";
import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import { addDaysToDateKey, isDateKey, startOfWeekDateKey, weekdayOfDateKey } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { AgendaAppointment } from "@/types";

type AgendaView = "dia" | "semana" | "lista";

const VIEWS: Array<{ value: AgendaView; label: string; icon: typeof ListIcon }> = [
  { value: "dia", label: "Dia", icon: RowsIcon },
  { value: "semana", label: "Semana", icon: CalendarDaysIcon },
  { value: "lista", label: "Lista", icon: ListIcon },
];



interface AgendaBoardProps {
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  /** Hoje (YYYY-MM-DD) no fuso do negócio, calculado no servidor. */
  today: string;
  /** Visão e data iniciais vindas da URL (lidas no servidor para evitar divergência de hidratação). */
  initialView?: string;
  initialDate?: string;
}

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

function dateLabel(dateKey: string, options: Intl.DateTimeFormatOptions) {
  // Meio-dia UTC: o dia de calendário não muda em nenhum fuso das Américas.
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Agenda: visões Dia (colunas por profissional), Semana (colunas por dia) e Lista. */
export function AgendaBoard({ timeZone, minStartTime, canSchedule, customers, services, today, initialView, initialDate }: AgendaBoardProps) {
  const now = useClinicNow(timeZone, today);
  const [view, setView] = useState<AgendaView>(() => (VIEWS.some((item) => item.value === initialView) ? initialView as AgendaView : "dia"));
  const [anchor, setAnchor] = useState(() => (isDateKey(initialDate) ? initialDate : today));
  const [showCanceled, setShowCanceled] = useState(false);
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [newSlot, setNewSlot] = useState<string | null>(null);

  const isWeek = view === "semana";
  const from = isWeek ? startOfWeekDateKey(anchor) : anchor;
  const days = isWeek ? 7 : 1;
  const { data, isPending, isError, isFetching, refetch } = useAppointmentsRange({ from, days });

  function changeView(next: AgendaView) {
    setView(next);
    replaceUrlSearchParams({ visao: next === "dia" ? null : next, pagina: null });
  }
  function changeAnchor(next: string) {
    setAnchor(next);
    replaceUrlSearchParams({ data: next === now.dateKey ? null : next });
  }
  const step = isWeek ? 7 : 1;

  const items = useMemo(
    () => (data?.items ?? [])
      .filter((item) => showCanceled || item.status !== "CANCELED")
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data?.items, showCanceled],
  );
  const dateKeys = useMemo(() => Array.from({ length: days }, (_, index) => addDaysToDateKey(from, index)), [from, days]);

  const columns = useMemo<AgendaGridColumn[]>(() => {
    const byDate = (dateKey: string) => items.filter((item) => localDateAndMinutes(item.startTime, timeZone).dateKey === dateKey);
    if (isWeek) {
      return dateKeys.map((dateKey) => ({
        key: dateKey,
        dateKey,
        title: dateLabel(dateKey, { weekday: "short", day: "numeric" }).replace(".", ""),
        items: byDate(dateKey),
        highlight: dateKey === now.dateKey,
      }));
    }
    // Dia: uma coluna por profissional (inclui quem já saiu, se tiver atendimento) e "Sem profissional".
    const dayItems = byDate(anchor);
    const professionals = new Map((data?.professionals ?? []).map((professional) => [professional.id, professional.name]));
    for (const item of dayItems) if (item.professionalId && !professionals.has(item.professionalId)) professionals.set(item.professionalId, item.professionalName ?? "Profissional");
    const result: AgendaGridColumn[] = [...professionals].map(([id, name]) => ({ key: id, dateKey: anchor, title: name, items: dayItems.filter((item) => item.professionalId === id) }));
    const unassigned = dayItems.filter((item) => !item.professionalId);
    if (unassigned.length || result.length === 0) result.push({ key: "sem-profissional", dateKey: anchor, title: result.length ? "Sem profissional" : "Atendimentos", items: unassigned });
    return result;
  }, [items, isWeek, dateKeys, anchor, data?.professionals, now.dateKey, timeZone]);

  const bounds = useMemo(() => {
    const weekdays = dateKeys.map(weekdayOfDateKey);
    const spans = items.map((item) => {
      const start = localDateAndMinutes(item.startTime, timeZone).minutes;
      const end = localDateAndMinutes(item.endTime, timeZone).minutes;
      return { start, end: end > start ? end : 24 * 60 };
    });
    return gridBounds(data?.hours ?? [], weekdays, spans);
  }, [data?.hours, dateKeys, items, timeZone]);

  const periodTitle = isWeek
    ? `${dateLabel(from, { day: "numeric", month: "short" })} – ${dateLabel(addDaysToDateKey(from, 6), { day: "numeric", month: "short", year: "numeric" })}`
    : dateLabel(anchor, { weekday: "long", day: "numeric", month: "long" });
  const isCurrentPeriod = isWeek ? startOfWeekDateKey(now.dateKey) === from : anchor === now.dateKey;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra: visão + navegação */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-lg border border-border/80 bg-muted/40 p-0.5" role="group" aria-label="Visão da agenda">
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={view === value ? "default" : "ghost"}
              aria-pressed={view === value}
              onClick={() => changeView(value)}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>

        {view !== "lista" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" aria-label={isWeek ? "Semana anterior" : "Dia anterior"} onClick={() => changeAnchor(addDaysToDateKey(anchor, -step))}><ChevronLeftIcon /></Button>
            <Button type="button" variant="outline" size="sm" disabled={isCurrentPeriod} onClick={() => changeAnchor(now.dateKey)}>Hoje</Button>
            <Button type="button" variant="outline" size="icon-sm" aria-label={isWeek ? "Próxima semana" : "Próximo dia"} onClick={() => changeAnchor(addDaysToDateKey(anchor, step))}><ChevronRightIcon /></Button>
            <h2 className="min-w-0 text-sm font-semibold first-letter:uppercase sm:text-base" aria-live="polite">{periodTitle}</h2>
          </div>
        ) : null}
      </div>

      {view === "lista" ? (
        <AgendaAppointmentsList timeZone={timeZone} minStartTime={minStartTime} canSchedule={canSchedule} customers={customers} services={services} />
      ) : isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Não foi possível carregar a agenda.
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3" aria-busy={isFetching}>
          <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showCanceled} onCheckedChange={(checked) => setShowCanceled(Boolean(checked))} />
            Mostrar cancelados
          </label>

          {/* Grade (tablet e desktop) */}
          <div className="hidden md:block">
            <AgendaTimeGrid
              columns={columns}
              timeZone={timeZone}
              gridStart={bounds.start}
              gridEnd={bounds.end}
              now={now}
              onSelectItem={setSelected}
              onSelectSlot={canSchedule ? (dateKey, minutes) => setNewSlot(`${dateKey}T${hhmm(minutes)}`) : undefined}
            />
          </div>

          {/* Lista compacta (celular) */}
          <div className="flex flex-col gap-4 md:hidden">
            {dateKeys.map((dateKey) => {
              const dayItems = items.filter((item) => localDateAndMinutes(item.startTime, timeZone).dateKey === dateKey);
              if (isWeek && dayItems.length === 0) return null;
              return (
                <section key={dateKey} aria-label={dateLabel(dateKey, { weekday: "long", day: "numeric", month: "long" })}>
                  {isWeek ? <h3 className={cn("mb-2 text-sm font-semibold first-letter:uppercase", dateKey === now.dateKey && "text-primary")}>{dateLabel(dateKey, { weekday: "long", day: "numeric", month: "short" })}</h3> : null}
                  {dayItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border border-border/80">
                      {dayItems.map((item) => (
                        <li key={item.id}>
                          <button type="button" onClick={() => setSelected(item)} className="flex w-full items-center gap-3 p-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40">
                            <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{hhmm(localDateAndMinutes(item.startTime, timeZone).minutes)}</span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate font-medium", item.status === "CANCELED" && "line-through")}>{item.customerName}</span>
                              <span className="block truncate text-xs text-muted-foreground">{item.serviceName}{item.professionalName ? ` · ${item.professionalName}` : ""}</span>
                            </span>
                            <Badge variant={appointmentStatusBadgeVariant(item.status)}>{appointmentStatusLabel(item.status)}</Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            {isWeek && items.length === 0 ? <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">Nenhum atendimento nesta semana.</p> : null}
          </div>
        </div>
      )}

      <AppointmentDetailsDialog
        appointment={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        timeZone={timeZone}
        minStartTime={minStartTime}
        canSchedule={canSchedule}
        customers={customers}
        services={services}
      />

      {canSchedule ? (
        <AppointmentFormDialog
          open={newSlot !== null}
          onOpenChange={(open) => { if (!open) setNewSlot(null); }}
          customers={customers}
          services={services}
          minStartTime={minStartTime}
          timeZone={timeZone}
          initialStartTime={newSlot ?? undefined}
        />
      ) : null}
    </div>
  );
}
