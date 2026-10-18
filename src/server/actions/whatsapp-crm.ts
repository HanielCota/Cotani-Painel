"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireClinicAction } from "@/server/clinic-action";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";

export async function markWhatsAppNotificationAsSent(notificationId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(notificationId);

  if (!parsedId.success) {
    return { status: "error", message: "Notificação inválida." };
  }

  const access = await requireClinicAction(["ADMIN", "RECEPTIONIST"], "Selecione um negócio antes de continuar.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  const notification = await prisma.notification.findFirst({
    where: {
      id: parsedId.data,
      clinicId: clinic.id,
      channel: "WHATSAPP",
      status: "PENDING",
    },
  });

  if (!notification) {
    return { status: "error", message: "Notificação não encontrada ou já enviada." };
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      providerRef: "wa.me:manual",
      lockedAt: null,
      error: null,
    },
  });

  revalidatePath("/dashboard/comunicacoes");
  return { status: "success", message: "Notificação marcada como enviada." };
}
