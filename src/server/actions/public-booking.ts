"use server";

import { headers } from "next/headers";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getNotificationChannels } from "@/config/subscription-plans";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { DOUBLE_BOOKING_MESSAGE, scheduleAppointment } from "@/server/services/scheduling";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { isClinicOperational } from "@/server/clinic-access";
import { isWithinBookingWindow } from "@/config/booking";

const publicBookingSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.uuid(),
  professionalId: z.uuid().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(32),
  customerEmail: z.email().trim().toLowerCase().optional(),
  startTime: z.coerce.date(),
  notes: z.string().trim().max(2_000).optional(),
});

const BOOKING_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60_000,
};

async function getClientIpFromHeaders(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return "unknown";
}

/**
 * Agendamento público (self-service), sem sessão autenticada. O escopo do tenant é
 * resolvido pelo slug da loja e todo o restante segue o mesmo núcleo
 * transacional do agendamento interno: validação de conflito, exclusion
 * constraint do banco e outbox de notificações na mesma transação.
 */
export async function createPublicAppointment(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const ip = await getClientIpFromHeaders();
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
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do agendamento." };
  }
  const normalizedPhone = normalizeWhatsAppPhone(parsed.data.customerPhone);
  if (!normalizedPhone) return { status: "error", message: "Informe um WhatsApp com DDD válido." };

  const clinic = await prisma.clinic.findUnique({
    where: { slug: parsed.data.slug, deletedAt: null },
  });

  if (!clinic) {
    return { status: "error", message: "Loja não encontrada." };
  }

  if (!isClinicOperational(clinic)) {
    return { status: "error", message: "Esta loja está temporariamente indisponível." };
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

  if (parsed.data.professionalId) {
    const professional = await prisma.professional.findFirst({
      where: {
        id: parsed.data.professionalId,
        clinicId: clinic.id,
        isActive: true,
        services: { some: { serviceId: parsed.data.serviceId } },
      },
    });

    if (!professional) {
      return { status: "error", message: "Profissional indisponível para este serviço." };
    }
  }

  if (!isWithinBookingWindow(parsed.data.startTime)) {
    return { status: "error", message: "Escolha um horário com pelo menos 15 minutos de antecedência e no máximo 180 dias no futuro." };
  }

  const result = await scheduleAppointment({
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
    professionalId: parsed.data.professionalId,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
  });

  if (result.status === "conflict") {
    return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
  }

  if (result.status === "error") {
    return { status: "error", message: "Não foi possível concluir o agendamento. Tente novamente." };
  }

  return { status: "success", message: "Agendamento realizado! A confirmação será enviada pelos canais disponíveis." };
}
