"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { parseClinicDateOnly } from "@/lib/timezone";
import { parseCustomerCsv } from "@/server/services/customer-import";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().optional(),
  phone: z.string().trim().min(8).max(32),
  notes: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  // Data sem horário (YYYY-MM-DD); convertida no fuso da loja após resolver o tenant.
  nextReturnAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
    return { status: "error", message: "Selecione um negócio antes de cadastrar clientes." };
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
        notes: parsed.data.notes || null,
        tags: parsed.data.tags ?? [],
        nextReturnAt: parsed.data.nextReturnAt ? parseClinicDateOnly(parsed.data.nextReturnAt, clinic.timeZone) : null,
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
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    nextReturnAt: String(formData.get("nextReturnAt") ?? "").trim() || undefined,
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
    return { status: "error", message: "Selecione um negócio antes de atualizar clientes." };
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
        notes: parsed.data.notes || null,
        tags: parsed.data.tags ?? [],
        nextReturnAt: parsed.data.nextReturnAt ? parseClinicDateOnly(parsed.data.nextReturnAt, clinic.timeZone) : null,
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
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    nextReturnAt: String(formData.get("nextReturnAt") ?? "").trim() || undefined,
  });
}

export async function importCustomersFromCsv(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser();
  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);
  if (!clinic || !isSubscriptionActive(clinic)) return { status: "error", message: clinic ? SUBSCRIPTION_INACTIVE_MESSAGE : "Selecione um negócio." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024) return { status: "error", message: "Selecione um CSV de até 1 MB." };

  const parsed = parseCustomerCsv(await file.text());
  if (!parsed.ok) return { status: "error", message: parsed.message };

  try {
    // Tudo ou nada: uma falha no meio não deixa a base meio importada.
    await prisma.$transaction(async (transaction) => {
      for (const row of parsed.rows) {
        await transaction.customer.upsert({
          where: { clinicId_phone: { clinicId: clinic.id, phone: row.phone } },
          create: { clinicId: clinic.id, name: row.name, phone: row.phone, email: row.email },
          // E-mail vazio na planilha não apaga o e-mail já cadastrado.
          update: { name: row.name, ...(row.email ? { email: row.email } : {}) },
        });
      }
    }, { timeout: 60_000 });
  } catch {
    return { status: "error", message: "Não foi possível importar a planilha. Nenhum cliente foi alterado." };
  }

  revalidatePath("/dashboard/clientes");
  const { ignored } = parsed;
  return { status: "success", message: `${parsed.rows.length} cliente(s) importado(s)${ignored ? `; ${ignored} linha(s) ignorada(s)` : ""}.` };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(customerId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível remover este cliente." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione um negócio antes de remover clientes." };
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

  // Appointment.customer tem onDelete: Restrict - remover cliente com histórico quebraria a integridade.
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
