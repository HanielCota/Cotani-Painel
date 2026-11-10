"use client";

import { dateLabel, hhmm, itemsOnDate } from "@/components/dashboard/agenda/agenda-board-helpers";
import { Badge } from "@/components/ui/badge";
import { localDateAndMinutes } from "@/lib/agenda-layout";
import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import { cn } from "@/lib/utils";
import type { AgendaAppointment } from "@/types";

interface AgendaMobileListProps {
  dateKeys: string[];
  items: AgendaAppointment[];
  timeZone: string;
  isWeek: boolean;
  todayDateKey: string;
  onSelectItem: (appointment: AgendaAppointment) => void;
}

/** Lista compacta (celular). */
export function AgendaMobileList({ dateKeys, items, timeZone, isWeek, todayDateKey, onSelectItem }: AgendaMobileListProps) {
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {dateKeys.map((dateKey) => (
        <AgendaMobileDay
          key={dateKey}
          dateKey={dateKey}
          dayItems={itemsOnDate(items, dateKey, timeZone)}
          timeZone={timeZone}
          isWeek={isWeek}
          isToday={dateKey === todayDateKey}
          onSelectItem={onSelectItem}
        />
      ))}
      {isWeek && items.length === 0 ? <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">Nenhum atendimento nesta semana.</p> : null}
    </div>
  );
}

interface AgendaMobileDayProps {
  dateKey: string;
  dayItems: AgendaAppointment[];
  timeZone: string;
  isWeek: boolean;
  isToday: boolean;
  onSelectItem: (appointment: AgendaAppointment) => void;
}

function AgendaMobileDay({ dateKey, dayItems, timeZone, isWeek, isToday, onSelectItem }: AgendaMobileDayProps) {
  if (isWeek && dayItems.length === 0) return null;

  return (
    <section aria-label={dateLabel(dateKey, { weekday: "long", day: "numeric", month: "long" })}>
      {isWeek ? <h3 className={cn("mb-2 text-sm font-semibold first-letter:uppercase", isToday && "text-primary")}>{dateLabel(dateKey, { weekday: "long", day: "numeric", month: "short" })}</h3> : null}
      {dayItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
      ) : (
        <ul className="divide-y rounded-lg border border-border/80">
          {dayItems.map((item) => (
            <AgendaMobileItem key={item.id} item={item} timeZone={timeZone} onSelectItem={onSelectItem} />
          ))}
        </ul>
      )}
    </section>
  );
}

interface AgendaMobileItemProps {
  item: AgendaAppointment;
  timeZone: string;
  onSelectItem: (appointment: AgendaAppointment) => void;
}

function AgendaMobileItem({ item, timeZone, onSelectItem }: AgendaMobileItemProps) {
  return (
    <li>
      <button type="button" onClick={() => onSelectItem(item)} className="flex w-full items-center gap-3 p-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40">
        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{hhmm(localDateAndMinutes(item.startTime, timeZone).minutes)}</span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-medium", item.status === "CANCELED" && "line-through")}>{item.customerName}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.serviceName}{item.professionalName ? ` · ${item.professionalName}` : ""}</span>
        </span>
        <Badge variant={appointmentStatusBadgeVariant(item.status)}>{appointmentStatusLabel(item.status)}</Badge>
      </button>
    </li>
  );
}
