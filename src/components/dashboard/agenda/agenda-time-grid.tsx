"use client";

import { layoutColumn } from "@/lib/agenda-layout";
import { appointmentStatusLabel } from "@/lib/display-labels";
import { cn } from "@/lib/utils";
import type { AgendaAppointment } from "@/types";

/** Altura de 1 hora na grade, em px. */
const HOUR_PX = 64;
const SLOT_MINUTES = 30;

export interface AgendaGridColumn {
  key: string;
  title: string;
  subtitle?: string;
  dateKey: string;
  items: AgendaAppointment[];
  /** Destaca a coluna (ex.: hoje na visão semanal). */
  highlight?: boolean;
}

interface AgendaTimeGridProps {
  columns: AgendaGridColumn[];
  timeZone: string;
  /** Minutos desde 00:00 do início e do fim do eixo. */
  gridStart: number;
  gridEnd: number;
  /** Data (YYYY-MM-DD) e minuto atuais no fuso do negócio, para a linha de "agora". */
  now: { dateKey: string; minutes: number };
  onSelectItem: (appointment: AgendaAppointment) => void;
  /** Clique num horário vago; ausente quando o usuário não pode agendar. */
  onSelectSlot?: (dateKey: string, minutes: number, column: AgendaGridColumn) => void;
}

const statusStyles: Record<AgendaAppointment["status"], string> = {
  PENDING: "border-l-warning bg-warning/10 hover:bg-warning/15",
  CONFIRMED: "border-l-primary bg-primary/10 hover:bg-primary/15",
  COMPLETED: "border-l-success bg-success/10 hover:bg-success/15",
  NO_SHOW: "border-l-destructive bg-destructive/10 hover:bg-destructive/15",
  CANCELED: "border-l-muted-foreground/50 bg-muted/60 text-muted-foreground line-through hover:bg-muted",
};

function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const px = (minutes: number) => (minutes / 60) * HOUR_PX;

export function AgendaTimeGrid({ columns, timeZone, gridStart, gridEnd, now, onSelectItem, onSelectSlot }: AgendaTimeGridProps) {
  const hours = Array.from({ length: Math.ceil((gridEnd - gridStart) / 60) }, (_, index) => gridStart + index * 60);
  const slots = Array.from({ length: Math.ceil((gridEnd - gridStart) / SLOT_MINUTES) }, (_, index) => gridStart + index * SLOT_MINUTES);
  const height = px(gridEnd - gridStart);
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <div className="grid min-w-full" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(9rem, 1fr))` }}>
        {/* Cabeçalho */}
        <div className="sticky left-0 z-20 border-b border-border/80 bg-card" />
        {columns.map((column) => (
          <div key={column.key} className={cn("border-b border-l border-border/80 bg-card px-2 py-2 text-center", column.highlight && "bg-accent/50")}>
            <p className={cn("truncate text-sm font-medium", column.highlight && "text-primary")}>{column.title}</p>
            {column.subtitle ? <p className="truncate text-xs text-muted-foreground">{column.subtitle}</p> : null}
          </div>
        ))}

        {/* Eixo de horas */}
        <div className="sticky left-0 z-10 bg-card" style={{ height }}>
          {hours.map((minutes) => (
            <div key={minutes} className="relative" style={{ height: HOUR_PX }}>
              <span className="absolute -top-2 right-2 text-xs tabular-nums text-muted-foreground">{minutes === gridStart ? "" : hhmm(minutes)}</span>
            </div>
          ))}
        </div>

        {columns.map((column) => {
          const positioned = layoutColumn(column.items, timeZone, gridStart, gridEnd);
          const isToday = column.dateKey === now.dateKey;
          const nowVisible = isToday && now.minutes >= gridStart && now.minutes <= gridEnd;
          return (
            <div key={column.key} className={cn("relative border-l border-border/80", column.highlight && "bg-accent/20")} style={{ height }}>
              {/* Linhas das horas */}
              {hours.map((minutes) => (
                <div key={minutes} aria-hidden="true" className="absolute inset-x-0 border-t border-border/60" style={{ top: px(minutes - gridStart) }} />
              ))}

              {/* Horários vagos clicáveis (atrás dos atendimentos) */}
              {onSelectSlot
                ? slots
                    .filter((minutes) => column.dateKey > now.dateKey || (isToday && minutes > now.minutes))
                    .map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => onSelectSlot(column.dateKey, minutes, column)}
                        aria-label={`Novo atendimento em ${column.title}${column.subtitle ? ` ${column.subtitle}` : ""} às ${hhmm(minutes)}`}
                        className="absolute inset-x-0 z-0 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                        style={{ top: px(minutes - gridStart), height: px(SLOT_MINUTES) }}
                      />
                    ))
                : null}

              {/* Atendimentos */}
              {positioned.map(({ item, top, height: itemHeight, lane, lanes }) => {
                // Faixas estreitas (3+ sobrepostos) ou curtas: uma linha só, "10:00 Nome".
                const compact = px(itemHeight) < 44 || lanes >= 3;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    title={`${item.customerName} · ${item.serviceName}`}
                    aria-label={`${timeFormatter.format(new Date(item.startTime))}, ${item.customerName}, ${item.serviceName}, ${appointmentStatusLabel(item.status)}`}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border border-l-4 border-border/50 px-1.5 py-1 text-left text-xs shadow-card outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      statusStyles[item.status],
                    )}
                    style={{
                      top: px(top) + 1,
                      height: Math.max(px(itemHeight) - 2, 18),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    {compact ? (
                      <span className="block truncate"><span className="tabular-nums">{timeFormatter.format(new Date(item.startTime))}</span> <span className="font-medium">{item.customerName}</span></span>
                    ) : (
                      <>
                        <span className="block truncate tabular-nums text-muted-foreground">{timeFormatter.format(new Date(item.startTime))} – {timeFormatter.format(new Date(item.endTime))}</span>
                        <span className="block truncate font-medium text-foreground">{item.customerName}</span>
                        <span className="block truncate text-muted-foreground">{item.serviceName}</span>
                      </>
                    )}
                  </button>
                );
              })}

              {/* Agora */}
              {nowVisible ? (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-destructive" style={{ top: px(now.minutes - gridStart) }}>
                  <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-destructive" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
