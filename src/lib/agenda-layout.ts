import { formatClinicDateTimeInput } from "@/lib/timezone";

/**
 * Cálculos puros da agenda em grade (dia/semana): limites do eixo de horas,
 * posição vertical de cada atendimento e "faixas" lado a lado quando há
 * sobreposição numa mesma coluna.
 */

export interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface TimedItem {
  id: string;
  startTime: string;
  endTime: string;
}

export interface PositionedItem<T extends TimedItem> {
  item: T;
  /** Distância do topo da grade, em minutos. */
  top: number;
  /** Altura em minutos (mínimo de 15 para continuar clicável). */
  height: number;
  /** Faixa (coluna interna) e total de faixas do grupo sobreposto. */
  lane: number;
  lanes: number;
}

const MIN_HEIGHT_MINUTES = 15;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Data (YYYY-MM-DD) e minuto do dia de um instante, no fuso do negócio. */
export function localDateAndMinutes(iso: string, timeZone: string) {
  const local = formatClinicDateTimeInput(new Date(iso), timeZone);
  return { dateKey: local.slice(0, 10), minutes: toMinutes(local.slice(11, 16)) };
}

/**
 * Faixa de horas exibida: do primeiro horário de abertura ao último de
 * fechamento dos dias exibidos, ampliada para caber atendimentos fora do
 * expediente. Arredonda para horas cheias; padrão 08:00-18:00.
 */
export function gridBounds(hours: readonly DayHours[], weekdays: readonly number[], itemMinutes: ReadonlyArray<{ start: number; end: number }>) {
  const open = hours.filter((hour) => hour.isOpen && weekdays.includes(hour.dayOfWeek));
  let start = open.length ? Math.min(...open.map((hour) => toMinutes(hour.openTime))) : 8 * 60;
  let end = open.length ? Math.max(...open.map((hour) => toMinutes(hour.closeTime))) : 18 * 60;
  for (const item of itemMinutes) {
    start = Math.min(start, item.start);
    end = Math.max(end, item.end);
  }
  start = Math.max(0, Math.floor(start / 60) * 60);
  end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  return { start, end: Math.max(end, start + 60) };
}

/**
 * Posiciona os atendimentos de uma coluna (um dia, ou um profissional num
 * dia). Itens que se sobrepõem dividem a largura em faixas.
 */
export function layoutColumn<T extends TimedItem>(items: readonly T[], timeZone: string, gridStart: number, gridEnd: number): PositionedItem<T>[] {
  const timed = items
    .map((item) => {
      const start = localDateAndMinutes(item.startTime, timeZone).minutes;
      const rawEnd = localDateAndMinutes(item.endTime, timeZone).minutes;
      // Atendimento que termina depois da meia-noite fica cortado no fim da grade.
      const end = rawEnd <= start ? gridEnd : rawEnd;
      return { item, start: Math.max(start, gridStart), end: Math.min(Math.max(end, start + MIN_HEIGHT_MINUTES), gridEnd) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const positioned: PositionedItem<T>[] = [];
  let group: Array<{ entry: (typeof timed)[number]; lane: number }> = [];
  let groupEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, ...group.map((member) => member.lane + 1));
    for (const { entry, lane } of group) {
      positioned.push({ item: entry.item, top: entry.start - gridStart, height: entry.end - entry.start, lane, lanes });
    }
    group = [];
  };

  for (const entry of timed) {
    if (group.length && entry.start >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    // Primeira faixa livre: a que terminou antes deste começar.
    const laneEnds = new Map<number, number>();
    for (const member of group) laneEnds.set(member.lane, Math.max(laneEnds.get(member.lane) ?? 0, member.entry.end));
    let lane = 0;
    while (laneEnds.has(lane) && (laneEnds.get(lane) ?? 0) > entry.start) lane += 1;
    group.push({ entry, lane });
    groupEnd = Math.max(groupEnd, entry.end);
  }
  if (group.length) flush();

  return positioned;
}
