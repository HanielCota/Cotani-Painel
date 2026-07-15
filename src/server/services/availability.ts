import prisma from "@/lib/prisma";
import { getClinicDateBounds, parseClinicDateTime } from "@/lib/timezone";

// Horário comercial fixo do MVP: ainda não existe modelagem de expediente por
// clínica no schema, então os slots são gerados entre 08h e 18h (hora local da
// clínica) em passos de 30 minutos. Quando o expediente virar dado (modelo
// BusinessHours por clínica/profissional), só este módulo muda.
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;
export const SLOT_STEP_MINUTES = 30;

export interface AvailabilitySlot {
  /** Instante de início do slot em ISO 8601 (UTC). */
  startTime: string;
  /** Rótulo no formato HH:mm, na hora local da clínica. */
  label: string;
}

export interface GetAvailableSlotsParams {
  clinicId: string;
  timeZone: string;
  /** Duração do serviço em minutos. */
  serviceDuration: number;
  /** Data no formato YYYY-MM-DD, interpretada no fuso da clínica. */
  date: string;
}

/**
 * Motor de disponibilidade: calcula os slots livres de um dia subtraindo os
 * atendimentos já marcados da grade de candidatos do expediente.
 *
 * Retorna `null` quando a data é inválida. A decisão de exibir ou não um slot
 * é derivada (ocupação + passado), nunca persistida — a verdade continua
 * sendo a tabela de atendimentos, e a garantia final contra concorrência é a
 * exclusion constraint do banco (ver services/scheduling.ts).
 */
export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailabilitySlot[] | null> {
  const dayStart = parseClinicDateTime(`${params.date}T00:00`, params.timeZone);

  if (!dayStart) {
    return null;
  }

  const { startOfTomorrow: dayEnd } = getClinicDateBounds(params.timeZone, dayStart);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: params.clinicId,
      status: { not: "CANCELED" },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  });

  const now = new Date();
  const slots: AvailabilitySlot[] = [];

  for (
    let minutes = BUSINESS_START_HOUR * 60;
    minutes + params.serviceDuration <= BUSINESS_END_HOUR * 60;
    minutes += SLOT_STEP_MINUTES
  ) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    const startTime = parseClinicDateTime(`${params.date}T${hour}:${minute}`, params.timeZone);

    if (!startTime || startTime <= now) {
      continue;
    }

    const endTime = new Date(startTime.getTime() + params.serviceDuration * 60_000);
    const overlaps = appointments.some((appointment) => startTime < appointment.endTime && endTime > appointment.startTime);

    if (overlaps) {
      continue;
    }

    slots.push({ startTime: startTime.toISOString(), label: `${hour}:${minute}` });
  }

  return slots;
}
