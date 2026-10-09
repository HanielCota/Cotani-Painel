"use server";

import { headers } from "next/headers";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getNotificationChannels } from "@/config/subscription-plans";
import { getClientIpFromHeaders } from "@/lib/get-client-ip";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import {
  DOUBLE_BOOKING_MESSAGE,
  rescheduleScheduledAppointment,
  scheduleAppointment,
} from "@/server/services/scheduling";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { isClinicOperational } from "@/server/clinic-access";
import { isWithinBookingWindow } from "@/config/booking";
import {
  bookingProfessionalSchema,
  orderByDailyLoad,
  resolveBookingProfessionals,
} from "@/server/services/booking-professionals";

const publicBookingSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.uuid(),
  professionalId: bookingProfessionalSchema.optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(32),
  customerEmail: z.email().trim().toLowerCase().optional(),
  startTime: z.coerce.date(),
  notes: z.string().trim().max(2_000).optional(),
  rescheduleToken: z.uuid().optional(),
});

/** Resultado da reserva pública; no sucesso, informa quem vai atender (útil em "sem preferência"). */
export type PublicBookingResult = ActionResult & { professionalName?: string };

/**
 * Tenta reservar com cada candidato, em ordem, até um aceitar. Cada tentativa
 * é uma transação completa (travas, validação e exclusion constraint), então
 * duas reservas "sem preferência" simultâneas no mesmo horário acabam com
 * profissionais diferentes - ou em conflito, se não sobrar ninguém.
 */
async function firstAvailable<T extends { status: string }>(
  candidates: readonly (string | null)[],
  attempt: (professionalId: string | null) => Promise<T>,
) {
  let result: T | { status: "conflict" } = { status: "conflict" };
  for (const professionalId of candidates) {
    result = await attempt(professionalId);
    if (result.status !== "conflict") return { result, professionalId };
  }
  return { result, professionalId: null };
}

const BOOKING_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60_000,
};

/**
 * Agendamento público (self-service), sem sessão autenticada. O escopo do tenant é
 * resolvido pelo slug da loja e todo o restante segue o mesmo núcleo
 * transacional do agendamento interno: validação de conflito, exclusion
 * constraint do banco e outbox de notificações na mesma transação.
 */
export async function createPublicAppointment(
  _previousState: ActionResult,
  formData: FormData,
): Promise<PublicBookingResult> {
  const ip = getClientIpFromHeaders(await headers());
  const limit = await rateLimit({ key: `public-booking:${ip}`, ...BOOKING_RATE_LIMIT });

  if (!limit.success) {
    return { status: "error", message: "Muitas tentativas de agendamento. Tente novamente em alguns minutos." };
  }

  const parsed = publicBookingSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    professionalId: formData.get("professionalId") || undefined,
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") || undefined,
    startTime: formData.get("startTime"),
    notes: formData.get("notes") || undefined,
    rescheduleToken: formData.get("rescheduleToken") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do agendamento." };
  }
  const normalizedPhone = normalizeWhatsAppPhone(parsed.data.customerPhone);
  if (!normalizedPhone) return { status: "error", message: "Informe um WhatsApp com DDD válido." };

  const clinic = await prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug: parsed.data.slug }, { slugAliases: { some: { slug: parsed.data.slug } } }] },
    include: { billingOwner: true },
  });

  if (!clinic) {
    return { status: "error", message: "Negócio não encontrado." };
  }

  if (!isClinicOperational(clinic)) {
    return { status: "error", message: "Este negócio está temporariamente indisponível." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true },
  });

  if (!service || service.duration <= 0) {
    return { status: "error", message: "Serviço indisponível para agendamento." };
  }

  const professionalIds = await resolveBookingProfessionals(clinic.id, service.id, parsed.data.professionalId);
  if (!professionalIds) {
    return { status: "error", message: "Profissional indisponível para este serviço." };
  }

  if (!isWithinBookingWindow(parsed.data.startTime)) {
    return {
      status: "error",
      message: "Escolha um horário com pelo menos 15 minutos de antecedência e no máximo 180 dias no futuro.",
    };
  }

  const candidates: (string | null)[] =
    professionalIds.length > 0
      ? await orderByDailyLoad(clinic.id, clinic.timeZone, parsed.data.startTime, professionalIds)
      : [null];
  const professionalNameOf = async (professionalId: string | null) =>
    professionalId
      ? (
          await prisma.professional.findFirst({
            where: { id: professionalId, clinicId: clinic.id },
            select: { name: true },
          })
        )?.name
      : undefined;

  if (parsed.data.rescheduleToken) {
    const existing = await prisma.appointment.findFirst({
      where: {
        cancellationToken: parsed.data.rescheduleToken,
        clinicId: clinic.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gt: new Date() },
      },
      include: { customer: true },
    });
    if (!existing) return { status: "error", message: "Este link de reagendamento não é mais válido." };
    const { result, professionalId } = await firstAvailable(candidates, (candidate) =>
      rescheduleScheduledAppointment({
        appointmentId: existing.id,
        clinicId: clinic.id,
        clinicSlug: clinic.slug,
        clinicName: clinic.name,
        timeZone: clinic.timeZone,
        customerId: existing.customerId,
        customerName: existing.customer.name,
        customerPhone: existing.customer.phone,
        customerEmail: existing.customer.email,
        notificationChannels: getNotificationChannels(clinic.subscriptionPlan),
        serviceId: service.id,
        serviceName: service.name,
        serviceDuration: service.duration,
        servicePrice: Number(service.price),
        professionalId: candidate,
        startTime: parsed.data.startTime,
        notes: parsed.data.notes,
        cancellationToken: existing.cancellationToken,
        maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
      }),
    );
    if (result.status === "conflict") return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
    if (result.status === "error") return { status: "error", message: "Não foi possível reagendar. Tente novamente." };
    return {
      status: "success",
      message: "Agendamento reagendado.",
      professionalName: await professionalNameOf(professionalId),
    };
  }

  const { result, professionalId } = await firstAvailable(candidates, (candidate) =>
    scheduleAppointment({
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      clinicName: clinic.name,
      timeZone: clinic.timeZone,
      customerName: parsed.data.customerName,
      customerPhone: normalizedPhone,
      customerEmail: parsed.data.customerEmail,
      notificationChannels: getNotificationChannels(clinic.subscriptionPlan),
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: Number(service.price),
      startTime: parsed.data.startTime,
      notes: parsed.data.notes,
      professionalId: candidate,
      maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
    }),
  );

  if (result.status === "conflict") {
    return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
  }

  if (result.status === "error") {
    return { status: "error", message: "Não foi possível concluir o agendamento. Tente novamente." };
  }

  return {
    status: "success",
    message: "Agendamento realizado. A confirmação será enviada pelos canais disponíveis.",
    professionalName: await professionalNameOf(professionalId),
  };
}
