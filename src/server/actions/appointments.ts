"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { parseClinicDateTime } from "@/lib/timezone";
import { getClinicForRoles } from "@/server/tenant";
import {
  DOUBLE_BOOKING_MESSAGE,
  rescheduleScheduledAppointment,
  scheduleAppointment,
} from "@/server/services/scheduling";
import { deletePendingNotifications } from "@/server/services/notifications";
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
const paymentMethodSchema = z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "OTHER"]);

const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusSchema,
  paymentMethod: paymentMethodSchema.optional(),
});

type AppointmentStatusUpdate = z.infer<typeof appointmentStatusSchema>;
type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;

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

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

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
    servicePrice: Number(service.price),
    startTime: parsed.data.startTime,
    notes: parsed.data.notes,
    professionalId: parsed.data.professionalId,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
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

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

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

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de reagendar." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, clinicId: clinic.id },
    include: { service: true, customer: true },
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

  const result = await rescheduleScheduledAppointment({
    appointmentId: appointment.id,
    clinicId: clinic.id,
    clinicSlug: clinic.slug,
    clinicName: clinic.name,
    timeZone: clinic.timeZone,
    customerId: appointment.customerId,
    customerName: appointment.customer.name,
    customerPhone: appointment.customer.phone,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    serviceDuration: appointment.service.duration,
    servicePrice: Number(appointment.priceAtBooking),
    professionalId: appointment.professionalId ?? undefined,
    startTime,
    cancellationToken: appointment.cancellationToken ?? undefined,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
  });

  if (result.status === "conflict") {
    return { status: "error", message: DOUBLE_BOOKING_MESSAGE };
  }

  if (result.status === "error") {
    return { status: "error", message: "Não foi possível reagendar o atendimento. Tente novamente." };
  }

  revalidateScheduleViews();
  return { status: "success", message: "Atendimento reagendado." };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  input: UpdateAppointmentStatusInput | AppointmentStatusUpdate,
): Promise<ActionResult> {
  await auth.protect();

  const parsedInput = updateAppointmentStatusSchema.safeParse(
    typeof input === "string" ? { status: input } : input,
  );
  const parsedId = z.uuid().safeParse(appointmentId);

  if (!parsedInput.success || !parsedId.success) {
    return { status: "error", message: "Não foi possível atualizar este atendimento." };
  }

  const { status: nextStatus, paymentMethod } = parsedInput.data;

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

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

  if (!allowedStatuses[appointment.status]?.includes(nextStatus)) {
    return { status: "error", message: "Essa mudança de status não é permitida." };
  }

  if (nextStatus === "COMPLETED" && !paymentMethod) {
    return { status: "error", message: "Informe o método de pagamento para concluir o atendimento." };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.appointment.update({
      where: { id: appointment.id },
      data: {
        status: nextStatus,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(nextStatus === "COMPLETED" ? { paidAt: new Date() } : {}),
      },
    });

    if (["COMPLETED", "CANCELED", "NO_SHOW"].includes(nextStatus)) {
      await deletePendingNotifications(transaction, appointment.id);
    }
  });

  revalidateScheduleViews();
  return { status: "success", message: "Status do atendimento atualizado." };
}
