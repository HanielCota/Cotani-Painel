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

type PublicBookingInput = z.infer<typeof publicBookingSchema>;

type BookingClinic = NonNullable<Awaited<ReturnType<typeof findClinicBySlug>>>;

type BookingService = NonNullable<Awaited<ReturnType<typeof findActiveService>>>;

interface BookingContext {
  clinic: BookingClinic;
  service: BookingService;
  input: PublicBookingInput;
  candidates: (string | null)[];
}

type Guarded<T> = { value: T; error?: never } | { value?: never; error: PublicBookingResult };

function bookingError(message: string): PublicBookingResult {
  return { status: "error", message };
}

async function isBookingRateLimited() {
  const ip = getClientIpFromHeaders(await headers());
  const limit = await rateLimit({ key: `public-booking:${ip}`, ...BOOKING_RATE_LIMIT });
  return !limit.success;
}

function parsePublicBookingForm(formData: FormData) {
  return publicBookingSchema.safeParse({
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
}

function findClinicBySlug(slug: string) {
  return prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    include: { billingOwner: true },
  });
}

function findActiveService(clinicId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, clinicId, isActive: true },
  });
}

async function resolveBookableClinic(slug: string): Promise<Guarded<BookingClinic>> {
  const clinic = await findClinicBySlug(slug);
  if (!clinic) return { error: bookingError("Negócio não encontrado.") };
  if (!isClinicOperational(clinic)) return { error: bookingError("Este negócio está temporariamente indisponível.") };
  if (!isSubscriptionActive(clinic)) return { error: bookingError(SUBSCRIPTION_INACTIVE_MESSAGE) };
  return { value: clinic };
}

async function resolveBookableService(clinicId: string, serviceId: string): Promise<Guarded<BookingService>> {
  const service = await findActiveService(clinicId, serviceId);
  if (!service || service.duration <= 0) return { error: bookingError("Serviço indisponível para agendamento.") };
  return { value: service };
}

async function orderCandidates(clinic: BookingClinic, startTime: Date, professionalIds: string[]) {
  if (professionalIds.length === 0) return [null];
  return orderByDailyLoad(clinic.id, clinic.timeZone, startTime, professionalIds);
}

/** Valida loja, serviço, profissional e janela de agendamento, na mesma ordem do fluxo original. */
async function resolveBookingContext(input: PublicBookingInput): Promise<Guarded<BookingContext>> {
  const clinicResult = await resolveBookableClinic(input.slug);
  if (clinicResult.error) return { error: clinicResult.error };
  const clinic = clinicResult.value;

  const serviceResult = await resolveBookableService(clinic.id, input.serviceId);
  if (serviceResult.error) return { error: serviceResult.error };
  const service = serviceResult.value;

  const professionalIds = await resolveBookingProfessionals(clinic.id, service.id, input.professionalId);
  if (!professionalIds) return { error: bookingError("Profissional indisponível para este serviço.") };

  if (!isWithinBookingWindow(input.startTime)) {
    return {
      error: bookingError(
        "Escolha um horário com pelo menos 15 minutos de antecedência e no máximo 180 dias no futuro.",
      ),
    };
  }

  const candidates: (string | null)[] = await orderCandidates(clinic, input.startTime, professionalIds);
  return { value: { clinic, service, input, candidates } };
}

async function findProfessionalName(clinicId: string, professionalId: string | null) {
  if (!professionalId) return undefined;

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, clinicId },
    select: { name: true },
  });
  return professional?.name;
}

function findReschedulableAppointment(clinicId: string, rescheduleToken: string) {
  return prisma.appointment.findFirst({
    where: {
      cancellationToken: rescheduleToken,
      clinicId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startTime: { gt: new Date() },
    },
    include: { customer: true },
  });
}

async function reschedulePublicAppointment(
  { clinic, service, input, candidates }: BookingContext,
  rescheduleToken: string,
): Promise<PublicBookingResult> {
  const existing = await findReschedulableAppointment(clinic.id, rescheduleToken);
  if (!existing) return bookingError("Este link de reagendamento não é mais válido.");

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
      startTime: input.startTime,
      notes: input.notes,
      cancellationToken: existing.cancellationToken,
      maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
    }),
  );

  if (result.status === "conflict") return bookingError(DOUBLE_BOOKING_MESSAGE);
  if (result.status === "error") return bookingError("Não foi possível reagendar. Tente novamente.");
  return {
    status: "success",
    message: "Agendamento reagendado.",
    professionalName: await findProfessionalName(clinic.id, professionalId),
  };
}

async function bookPublicAppointment(
  { clinic, service, input, candidates }: BookingContext,
  normalizedPhone: string,
): Promise<PublicBookingResult> {
  const { result, professionalId } = await firstAvailable(candidates, (candidate) =>
    scheduleAppointment({
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      clinicName: clinic.name,
      timeZone: clinic.timeZone,
      customerName: input.customerName,
      customerPhone: normalizedPhone,
      customerEmail: input.customerEmail,
      notificationChannels: getNotificationChannels(clinic.subscriptionPlan),
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: Number(service.price),
      startTime: input.startTime,
      notes: input.notes,
      professionalId: candidate,
      maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
    }),
  );

  if (result.status === "conflict") return bookingError(DOUBLE_BOOKING_MESSAGE);
  if (result.status === "error") return bookingError("Não foi possível concluir o agendamento. Tente novamente.");
  return {
    status: "success",
    message: "Agendamento realizado. A confirmação será enviada pelos canais disponíveis.",
    professionalName: await findProfessionalName(clinic.id, professionalId),
  };
}

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
  if (await isBookingRateLimited()) {
    return bookingError("Muitas tentativas de agendamento. Tente novamente em alguns minutos.");
  }

  const parsed = parsePublicBookingForm(formData);
  if (!parsed.success) return bookingError("Revise os dados do agendamento.");

  const normalizedPhone = normalizeWhatsAppPhone(parsed.data.customerPhone);
  if (!normalizedPhone) return bookingError("Informe um WhatsApp com DDD válido.");

  const context = await resolveBookingContext(parsed.data);
  if (context.error) return context.error;

  const { rescheduleToken } = parsed.data;
  if (rescheduleToken) return reschedulePublicAppointment(context.value, rescheduleToken);

  return bookPublicAppointment(context.value, normalizedPhone);
}
