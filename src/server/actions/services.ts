"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireActiveClinic } from "@/server/tenant";
import type { ActionResult } from "@/types";

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  duration: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100_000),
});

const updateServiceSchema = serviceSchema.extend({
  serviceId: z.uuid(),
});

function revalidateServiceViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/configuracoes");
}

export async function createService(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do serviço." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de cadastrar serviços." };
  }

  try {
    await prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: parsed.data.name,
        duration: parsed.data.duration,
        price: parsed.data.price,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível cadastrar este serviço. Tente novamente." };
  }

  revalidateServiceViews();
  return { status: "success", message: "Serviço cadastrado." };
}

export async function createServiceFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return createService({
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
  });
}

export async function updateService(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = updateServiceSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do serviço." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de atualizar serviços." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id },
    select: { id: true },
  });

  if (!service) {
    return { status: "error", message: "Serviço não encontrado." };
  }

  try {
    await prisma.service.update({
      where: { id: service.id },
      data: {
        name: parsed.data.name,
        duration: parsed.data.duration,
        price: parsed.data.price,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível atualizar este serviço. Tente novamente." };
  }

  revalidateServiceViews();
  return { status: "success", message: "Serviço atualizado." };
}

export async function updateServiceFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return updateService({
    serviceId: formData.get("serviceId"),
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
  });
}

export async function toggleServiceActive(serviceId: string): Promise<ActionResult> {
  await auth.protect();

  const parsedId = z.uuid().safeParse(serviceId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível alterar este serviço." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de alterar serviços." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true, isActive: true },
  });

  if (!service) {
    return { status: "error", message: "Serviço não encontrado." };
  }

  const nextIsActive = !service.isActive;

  if (!nextIsActive) {
    const pendingAppointments = await prisma.appointment.count({
      where: {
        serviceId: service.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: new Date() },
      },
    });

    if (pendingAppointments > 0) {
      return {
        status: "error",
        message: "Este serviço possui agendamentos futuros pendentes ou confirmados. Cancele ou reagende-os antes de desativar.",
      };
    }
  }

  await prisma.service.update({
    where: { id: service.id },
    data: { isActive: nextIsActive },
  });

  revalidateServiceViews();
  return { status: "success", message: nextIsActive ? "Serviço reativado." : "Serviço desativado." };
}
