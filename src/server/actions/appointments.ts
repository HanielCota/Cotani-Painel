"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { parseClinicDateTime } from "@/lib/timezone";
import { requireActiveClinic } from "@/server/tenant";
import {
  DOUBLE_BOOKING_MESSAGE,
  isDoubleBookingError,
  scheduleAppointment,
} from "@/server/services/scheduling";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";

const appointmentSchema = z.object({
  customerId: z.uuid(),
  serviceId: z.uuid(),
  professionalId: z.uuid().optional(),
  startTime: z.date(),
  notes: z.string().trim().max(2_000).optional(),
});

const rescheduleSchema = z.object({
  appointmentId: z.uuid(),
  startTime: z.string().trim(),
});

const appointmentStatusSchema = z.enum(["CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]);

type AppointmentStatusUpdate = z.infer<typeof appointmentStatusSchema>;

async function hasSchedulingConflict({
  clinicId,
  customerId,
  serviceId,
  professionalId,
  startTime,
  endTime,
  appointmentId,
}: {
  clinicId: string;
  customerId: string;
  serviceId: string;
  professionalId?: string | null;
  startTime: Date;
  endTime: Date;
  appointmentId?: string;
}) {
  const conflictConditions: Array<Record<string, unknown>> = [{ customerId }];

  if (professionalId) {
    conflictConditions.push({ professionalId });
  } else {
    conflictConditions.push({ serviceId });
  }

  return prisma.appointment.findFirst({
    where: {
      clinicId,
      ...(appointmentId ? { id: { not: appointmentId } } : {}),
      status: { not: "CANCELED" },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: conflictConditions,
    },
    select: { id: true },
  });
}

function revalidateScheduleViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/relatorios");
}

export async function createAppointment(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = appointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do agendamento." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de criar agendamentos." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const [customer, service, professional] = await Promise.all([
    prisma.customer.findFirst({ where: { id: parsed.data.customerId, clinicId: clinic.id } }),
    prisma.service.findFirst({ where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true } }),
    parsed.data.professionalId
      ? prisma.professional.findFirst({
          where: {
            id: parsed.data.professionalId,
            clinicId: clinic.id,
            isActive: true,
            services: { some: { serviceId: parsed.data.serviceId } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!customer || !service) {
    return { status: "error", message: "O cliente ou o serviço não pertence à barbearia ativa." };
  }

  if (parsed.data.professionalId && !professional) {
    return { status: "error", message: "Profissional indisponível para este serviço." };
  }

  if (service.duration <= 0) {
    return { status: "error", message: "O serviço selecionado possui uma duração inválida." };
  }

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
    professionalId: parsed.data.professionalId,
  });

  if (result.status === "conflict") {
    return { status: "error", message: "Já existe um atendimento nesse horário para o cliente ou serviço selecionado." };
  }

  if (result.status === "error") {
    return { status: "error", message: "Não foi possível criar o agendamento. Tente novamente." };
  }

  revalidateScheduleViews();
  return { status: "success", message: "Agendamento criado." };
}

export async function createAppointmentFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de criar agendamentos." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const startTime = parseClinicDateTime(String(formData.get("startTime") ?? ""), clinic.timeZone);

  if (!startTime) {
    return { status: "error", message: "Informe uma data e horário válidos." };
  }

  if (startTime <= new Date()) {
    return { status: "error", message: "Escolha um horário futuro para o atendimento." };
  }

  return createAppointment({
    customerId: formData.get("customerId"),
    serviceId: formData.get("serviceId"),
    professionalId: formData.get("professionalId") || undefined,
    startTime,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
}

export async function rescheduleAppointmentFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await auth.protect();

  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    startTime: formData.get("startTime"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Informe uma nova data e horário válidos." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de reagendar." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, clinicId: clinic.id },
    include: { service: true },
  });

  if (!appointment || !["PENDING", "CONFIRMED"].includes(appointment.status)) {
    return { status: "error", message: "Este atendimento não pode mais ser reagendado." };
  }

  const startTime = parseClinicDateTime(parsed.data.startTime, clinic.timeZone);

  if (!startTime) {
    return { status: "error", message: "Informe uma nova data e horário válidos." };
  }

  if (startTime <= new Date()) {
    return { status: "error", message: "Escolha um horário futuro para o atendimento." };
  }

  const endTime = new Date(startTime.getTime() + appointment.service.duration * 60_000);
  const conflictingAppointment = await hasSchedulingConflict({
    clinicId: clinic.id,
    customerId: appointment.customerId,
    serviceId: appointment.serviceId,
    professionalId: appointment.professionalId,
    startTime,
    endTime,
    appointmentId: appointment.id,
  });

  if (conflictingAppointment) {
    return { status: "error", message: "Já existe um atendimento nesse horário para o cliente ou serviço selecionado." };
  }

  try {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { startTime, endTime },
    });
  } catch (error) {
    // Rede de segurança: se a exclusion constraint disparar (concorrência real
    // entre o check acima e o update), devolve mensagem amigável em vez de 500.
    if (isDoubleBookingError(error)) {
      return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
    }

    throw error;
  }

  revalidateScheduleViews();
  return { status: "success", message: "Atendimento reagendado." };
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatusUpdate): Promise<ActionResult> {
  await auth.protect();

  const parsedStatus = appointmentStatusSchema.safeParse(status);
  const parsedId = z.uuid().safeParse(appointmentId);

  if (!parsedStatus.success || !parsedId.success) {
    return { status: "error", message: "Não foi possível atualizar este atendimento." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de atualizar atendimentos." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true, status: true },
  });

  if (!appointment) {
    return { status: "error", message: "Atendimento não encontrado." };
  }

  const allowedStatuses: Record<string, AppointmentStatusUpdate[]> = {
    PENDING: ["CONFIRMED", "CANCELED", "NO_SHOW"],
    CONFIRMED: ["COMPLETED", "CANCELED", "NO_SHOW"],
  };

  if (!allowedStatuses[appointment.status]?.includes(parsedStatus.data)) {
    return { status: "error", message: "Essa mudança de status não é permitida." };
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: parsedStatus.data },
  });

  revalidateScheduleViews();
  return { status: "success", message: "Status do atendimento atualizado." };
}
