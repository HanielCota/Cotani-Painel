"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { deletePendingNotifications } from "@/server/services/notifications";
import type { ActionResult } from "@/types";

const cancelSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  token: z.string().trim().min(1),
});

export async function cancelAppointmentByToken(input: unknown): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Link de cancelamento inválido." };
  }

  const { slug, token } = parsed.data;

  const clinic = await prisma.clinic.findUnique({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (!clinic) {
    return { status: "error", message: "Loja não encontrada." };
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      cancellationToken: token,
      clinicId: clinic.id,
    },
    select: { id: true, status: true, startTime: true },
  });

  if (!appointment) {
    return { status: "error", message: "Agendamento não encontrado ou já cancelado." };
  }

  if (appointment.status === "CANCELED") {
    return { status: "success", message: "Este agendamento já estava cancelado." };
  }

  if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
    return { status: "error", message: "Este agendamento não pode mais ser cancelado." };
  }

  if (appointment.startTime <= new Date()) {
    return { status: "error", message: "Não é possível cancelar agendamentos passados ou em andamento." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELED" },
      });

      await deletePendingNotifications(transaction, appointment.id);
    });
  } catch {
    return { status: "error", message: "Não foi possível cancelar o agendamento. Tente novamente." };
  }

  try {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/agenda");
  } catch {
    // revalidatePath só está disponível dentro de uma requisição Next.js.
    // Fora desse contexto (ex: scripts de teste) ignoramos silenciosamente.
  }

  return { status: "success", message: "Agendamento cancelado com sucesso." };
}

export async function cancelAppointmentByTokenFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return cancelAppointmentByToken({
    slug: formData.get("slug"),
    token: formData.get("token"),
  });
}
