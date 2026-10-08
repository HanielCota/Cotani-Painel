import "server-only";

import { z } from "zod";

import { ANY_PROFESSIONAL_ID } from "@/config/booking";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";

/** `professionalId` aceito na reserva pública: um UUID ou "sem preferência". */
export const bookingProfessionalSchema = z.union([z.uuid(), z.literal(ANY_PROFESSIONAL_ID)]);

/**
 * Profissionais candidatos de uma reserva pública:
 * - sem `professionalId`: `[]` (modo legado, sem profissional);
 * - um UUID: `[id]`, se o profissional estiver ativo e atender o serviço;
 * - "sem preferência": todos os ativos que atendem o serviço.
 *
 * Retorna `null` quando o profissional pedido não pode atender o serviço.
 */
export async function resolveBookingProfessionals(clinicId: string, serviceId: string, professionalId: string | undefined): Promise<string[] | null> {
  if (!professionalId) return [];

  const where = { clinicId, isActive: true, services: { some: { serviceId } } };
  if (professionalId === ANY_PROFESSIONAL_ID) {
    const professionals = await prisma.professional.findMany({ where, select: { id: true }, orderBy: { name: "asc" } });
    return professionals.map((professional) => professional.id);
  }

  const professional = await prisma.professional.findFirst({ where: { ...where, id: professionalId }, select: { id: true } });
  return professional ? [professional.id] : null;
}

/**
 * Ordena os candidatos do menos ao mais ocupado no dia do atendimento, para
 * distribuir as reservas "sem preferência". Empate mantém a ordem recebida.
 */
export async function orderByDailyLoad(clinicId: string, timeZone: string, startTime: Date, professionalIds: readonly string[]): Promise<string[]> {
  if (professionalIds.length < 2) return [...professionalIds];

  const { startOfToday, startOfTomorrow } = getClinicDateBounds(timeZone, startTime);
  const appointments = await prisma.appointment.findMany({
    where: { clinicId, professionalId: { in: [...professionalIds] }, status: { not: "CANCELED" }, startTime: { lt: startOfTomorrow }, endTime: { gt: startOfToday } },
    select: { professionalId: true },
  });
  const load = new Map<string, number>();
  for (const appointment of appointments) {
    if (appointment.professionalId) load.set(appointment.professionalId, (load.get(appointment.professionalId) ?? 0) + 1);
  }
  return [...professionalIds].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
}
