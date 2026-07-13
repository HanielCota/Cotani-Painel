"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { parseClinicDateTime } from "@/lib/timezone";
import { requireActiveClinic } from "@/server/tenant";
import type { ActionResult } from "@/types";

const appointmentSchema = z.object({
  customerId: z.uuid(),
  serviceId: z.uuid(),
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
  startTime,
  endTime,
  appointmentId,
}: {
  clinicId: string;
  customerId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  appointmentId?: string;
}) {
  return prisma.appointment.findFirst({
    where: {
      clinicId,
      ...(appointmentId ? { id: { not: appointmentId } } : {}),
      status: { not: "CANCELED" },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [{ customerId }, { serviceId }],
    },
    select: { id: true },
  });
}

export async function createAppointment(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = appointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do agendamento." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma clínica antes de criar agendamentos." };
  }

  const [customer, service] = await Promise.all([
    prisma.customer.findFirst({ where: { id: parsed.data.customerId, clinicId: clinic.id } }),
    prisma.service.findFirst({ where: { id: parsed.data.serviceId, clinicId: clinic.id, isActive: true } }),
  ]);

  if (!customer || !service) {
    return { status: "error", message: "O cliente ou o serviço não pertence à clínica ativa." };
  }

  const endTime = new Date(parsed.data.startTime.getTime() + service.duration * 60_000);

  if (service.duration <= 0) {
    return { status: "error", message: "O serviço selecionado possui uma duração inválida." };
  }

  try {
    const wasCreated = await prisma.$transaction(async (transaction) => {
      const conflictingAppointment = await transaction.appointment.findFirst({
        where: {
          clinicId: clinic.id,
          status: { not: "CANCELED" },
          startTime: { lt: endTime },
          endTime: { gt: parsed.data.startTime },
          OR: [{ customerId: customer.id }, { serviceId: service.id }],
        },
        select: { id: true },
      });

      if (conflictingAppointment) {
        return false;
      }

      await transaction.appointment.create({
        data: {
          clinicId: clinic.id,
          customerId: customer.id,
          serviceId: service.id,
          startTime: parsed.data.startTime,
          endTime,
          notes: parsed.data.notes,
        },
      });

      return true;
    });

    if (!wasCreated) {
      return { status: "error", message: "Já existe um atendimento nesse horário para o cliente ou serviço selecionado." };
    }
  } catch {
    return { status: "error", message: "Não foi possível criar o agendamento. Tente novamente." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { status: "success", message: "Agendamento criado." };
}

export async function createAppointmentFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma clínica antes de criar agendamentos." };
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
    return { status: "error", message: "Selecione uma clínica antes de reagendar." };
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
    startTime,
    endTime,
    appointmentId: appointment.id,
  });

  if (conflictingAppointment) {
    return { status: "error", message: "Já existe um atendimento nesse horário para o cliente ou serviço selecionado." };
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { startTime, endTime },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
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
    return { status: "error", message: "Selecione uma clínica antes de atualizar atendimentos." };
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { status: "success", message: "Status do atendimento atualizado." };
}
