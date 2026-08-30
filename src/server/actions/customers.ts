"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().optional(),
  phone: z.string().trim().min(8).max(32),
});

const updateCustomerSchema = customerSchema.extend({
  customerId: z.uuid(),
});

export async function createCustomer(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do cliente." };
  }
  const normalizedPhone = normalizeWhatsAppPhone(parsed.data.phone);
  if (!normalizedPhone) return { status: "error", message: "Informe um telefone com DDD válido." };

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma loja antes de cadastrar clientes." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  try {
    await prisma.customer.create({
      data: {
        clinicId: clinic.id,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: normalizedPhone,
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

export async function updateCustomer(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = updateCustomerSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do cliente." };
  }
  const normalizedPhone = normalizeWhatsAppPhone(parsed.data.phone);
  if (!normalizedPhone) return { status: "error", message: "Informe um telefone com DDD válido." };

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma loja antes de atualizar clientes." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, clinicId: clinic.id },
    select: { id: true },
  });

  if (!customer) {
    return { status: "error", message: "Cliente não encontrado." };
  }

  try {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: normalizedPhone,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível atualizar este cliente. Verifique se o telefone já está em uso." };
  }

  revalidatePath("/dashboard/clientes");
  return { status: "success", message: "Cliente atualizado." };
}

export async function updateCustomerFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  return updateCustomer({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: email || undefined,
  });
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(customerId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível remover este cliente." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma loja antes de remover clientes." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true },
  });

  if (!customer) {
    return { status: "error", message: "Cliente não encontrado." };
  }

  // Appointment.customer tem onDelete: Restrict — remover cliente com histórico quebraria a integridade.
  const appointments = await prisma.appointment.count({
    where: { customerId: customer.id },
  });

  if (appointments > 0) {
    return { status: "error", message: "Este cliente possui atendimentos e não pode ser removido." };
  }

  await prisma.customer.delete({
    where: { id: customer.id },
  });

  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  return { status: "success", message: "Cliente removido." };
}
