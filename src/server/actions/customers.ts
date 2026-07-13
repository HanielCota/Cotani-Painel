"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireActiveClinic } from "@/server/tenant";
import type { ActionResult } from "@/types";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().optional(),
  phone: z.string().trim().min(8).max(32),
});

export async function createCustomer(input: unknown): Promise<ActionResult> {
  await auth.protect();

  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do cliente." };
  }

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return { status: "error", message: "Selecione uma clínica antes de cadastrar clientes." };
  }

  try {
    await prisma.customer.create({
      data: {
        clinicId: clinic.id,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: "Não foi possível cadastrar este cliente." };
    }

    return { status: "error", message: "Ocorreu um erro inesperado ao cadastrar o cliente." };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { status: "success", message: "Cliente cadastrado." };
}

export async function createCustomerFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  return createCustomer({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: email || undefined,
  });
}
