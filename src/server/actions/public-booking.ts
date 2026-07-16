"use server";

import { z } from "zod";

import prisma from "@/lib/prisma";
import { DOUBLE_BOOKING_MESSAGE, scheduleAppointment } from "@/server/services/scheduling";
import type { ActionResult } from "@/types";

const publicBookingSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.uuid(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(32),
  customerEmail: z.email().trim().toLowerCase().optional(),
  startTime: z.coerce.date(),
  notes: z.string().trim().max(2_000).optional(),
});

/**
 * Agendamento público (self-service), sem sessão Clerk. O escopo do tenant é
 * resolvido pelo slug da barbearia e todo o restante segue o mesmo núcleo
 * transacional do agendamento interno: validação de conflito, exclusion
 * constraint do banco e outbox de notificações na mesma transação.
 */
export async function createPublicAppointment(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = publicBookingSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") || undefined,
    startTime: formData.get("startTime"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do agendamento." };
  }

  const clinic = await prisma.clinic.findUnique({
    where: { slug: parsed.data.slug },
  });

  if (!clinic) {
    return { status: "error", message: "Barbearia não encontrada." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true },
  });

  if (!service || service.duration <= 0) {
    return { status: "error", message: "Serviço indisponível para agendamento." };
  }

  if (parsed.data.startTime <= new Date()) {
    return { status: "error", message: "Escolha um horário futuro para o atendimento." };
  }

  const customer = await prisma.customer.upsert({
    where: { clinicId_phone: { clinicId: clinic.id, phone: parsed.data.customerPhone } },
    create: {
      clinicId: clinic.id,
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      email: parsed.data.customerEmail,
    },
    update: {
      name: parsed.data.customerName,
      ...(parsed.data.customerEmail ? { email: parsed.data.customerEmail } : {}),
    },
  });

  const result = await scheduleAppointment({
    clinicId: clinic.id,
    clinicSlug: clinic.slug,
    clinicName: clinic.name,
    timeZone: clinic.timeZone,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    serviceId: service.id,
    serviceName: service.name,
    serviceDuration: service.duration,
    startTime: parsed.data.startTime,
    notes: parsed.data.notes,
  });

  if (result.status === "conflict") {
    return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
  }

  if (result.status === "error") {
    return { status: "error", message: "Não foi possível concluir o agendamento. Tente novamente." };
  }

  return { status: "success", message: "Agendamento realizado! Você receberá uma confirmação no WhatsApp." };
}
