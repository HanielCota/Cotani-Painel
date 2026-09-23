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
  notes: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  nextReturnAt: z.coerce.date().optional(),
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
        notes: parsed.data.notes || null,
        tags: parsed.data.tags ?? [],
        nextReturnAt: parsed.data.nextReturnAt,
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
        notes: parsed.data.notes || null,
        tags: parsed.data.tags ?? [],
        nextReturnAt: parsed.data.nextReturnAt ?? null,
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

function parseCsvLine(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim()); return values;
}

export async function importCustomersFromCsv(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser();
  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);
  if (!clinic || !isSubscriptionActive(clinic)) return { status: "error", message: clinic ? SUBSCRIPTION_INACTIVE_MESSAGE : "Selecione uma loja." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024) return { status: "error", message: "Selecione um CSV de até 1 MB." };
  const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2 || lines.length > 5001) return { status: "error", message: "O arquivo deve ter cabeçalho e até 5.000 clientes." };
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const nameIndex = headers.indexOf("nome"); const phoneIndex = headers.indexOf("telefone"); const emailIndex = headers.indexOf("email");
  if (nameIndex < 0 || phoneIndex < 0) return { status: "error", message: "Use as colunas nome, telefone e email." };
  let imported = 0; let ignored = 0;
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line); const name = values[nameIndex]?.trim(); const phone = normalizeWhatsAppPhone(values[phoneIndex] ?? ""); const email = values[emailIndex]?.trim().toLowerCase() || null;
    if (!name || name.length < 2 || !phone || (email && !z.email().safeParse(email).success)) { ignored += 1; continue; }
    await prisma.customer.upsert({ where: { clinicId_phone: { clinicId: clinic.id, phone } }, create: { clinicId: clinic.id, name: name.slice(0, 120), phone, email }, update: { name: name.slice(0, 120), email } });
    imported += 1;
  }
  revalidatePath("/dashboard/clientes");
  return { status: "success", message: `${imported} cliente(s) importado(s)${ignored ? `; ${ignored} linha(s) ignorada(s)` : ""}.` };
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
