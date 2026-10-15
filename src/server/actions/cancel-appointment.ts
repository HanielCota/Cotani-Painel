"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getErrorMetadata } from "@/lib/error-metadata";
import { getClientIpFromHeaders } from "@/lib/get-client-ip";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deletePendingNotifications } from "@/server/services/notifications";
import type { ActionResult } from "@/types";

const cancelSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  token: z.uuid(),
});

const CANCEL_RATE_LIMIT = { limit: 10, windowMs: 15 * 60_000 };

export async function cancelAppointmentByToken(input: unknown): Promise<ActionResult> {
  const ip = getClientIpFromHeaders(await headers());
  const limit = await rateLimit({ key: `public-cancel:${ip}`, ...CANCEL_RATE_LIMIT });

  if (!limit.success) {
    return { status: "error", message: "Muitas tentativas de cancelamento. Tente novamente em alguns minutos." };
  }

  const parsed = cancelSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Link de cancelamento inválido." };
  }

  const { slug, token } = parsed.data;

  const clinic = await prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: { id: true },
  });

  if (!clinic) {
    return { status: "error", message: "Negócio não encontrado." };
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
    const canceled = await prisma.$transaction(async (transaction) => {
      const result = await transaction.appointment.updateMany({
        where: {
          id: appointment.id,
          clinicId: clinic.id,
          status: appointment.status,
          startTime: { gt: new Date() },
        },
        data: { status: "CANCELED" },
      });

      if (result.count === 1) {
        await deletePendingNotifications(transaction, appointment.id);
      }

      return result.count === 1;
    });

    if (!canceled) {
      return { status: "error", message: "Este agendamento foi alterado e não pode mais ser cancelado por este link." };
    }
  } catch (error) {
    logger.error("Falha ao cancelar agendamento pelo link", { clinicId: clinic.id, appointmentId: appointment.id, ...getErrorMetadata(error) });
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
