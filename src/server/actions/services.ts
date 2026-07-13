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

export async function createService(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do serviço." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma clínica antes de cadastrar serviços." };
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { status: "success", message: "Serviço cadastrado." };
}

export async function createServiceFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return createService({
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
  });
}
