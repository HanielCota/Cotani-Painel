"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";

const settingsSchema = z.object({
  maxAppointmentsPerDay: z.coerce.number().int().min(1).optional().or(z.literal("")),
});

export async function saveClinicSettings(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const rawValue = formData.get("maxAppointmentsPerDay");
  const parsed = settingsSchema.safeParse({
    maxAppointmentsPerDay: rawValue === "" || rawValue === null ? "" : rawValue,
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise o limite diário informado." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma loja antes de salvar." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const maxAppointmentsPerDay = parsed.data.maxAppointmentsPerDay === "" || parsed.data.maxAppointmentsPerDay === undefined
    ? null
    : parsed.data.maxAppointmentsPerDay;

  try {
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { maxAppointmentsPerDay },
    });
  } catch {
    return { status: "error", message: "Não foi possível salvar as configurações. Tente novamente." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { status: "success", message: "Configurações salvas." };
}
