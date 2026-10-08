"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseClinicDateOnly } from "@/lib/timezone";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { requireAuthenticatedUser } from "@/server/auth";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import { normalizeEntryPayment } from "@/server/services/financial-entries";
import type { ActionResult } from "@/types";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  id: z.uuid().optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "REFUNDED", "CANCELED"]),
  description: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional(),
  amount: z.coerce.number().positive().max(1_000_000),
  paidAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  dueDate: dateOnly.optional(),
  occurredAt: dateOnly,
  notes: z.string().trim().max(1000).optional(),
});

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || undefined;
}

function readEntryForm(formData: FormData) {
  return {
    id: optionalText(formData, "id"),
    type: formData.get("type"),
    status: formData.get("status"),
    description: formData.get("description"),
    category: optionalText(formData, "category"),
    amount: formData.get("amount"),
    paidAmount: optionalText(formData, "paidAmount"),
    dueDate: optionalText(formData, "dueDate"),
    occurredAt: formData.get("occurredAt"),
    notes: optionalText(formData, "notes"),
  };
}

async function getFinanceClinic() {
  await requireAuthenticatedUser();
  const clinic = await getClinicForRoles(["ADMIN"]);
  if (!clinic) return { ok: false, message: "Selecione uma loja." } as const;
  if (!isSubscriptionActive(clinic)) return { ok: false, message: SUBSCRIPTION_INACTIVE_MESSAGE } as const;
  // A página já esconde o módulo, mas a action pode ser chamada diretamente.
  if (!getPlanEntitlements(clinic.subscriptionPlan).finance) return { ok: false, message: "O financeiro está disponível a partir do plano Profissional." } as const;
  return { ok: true, clinic } as const;
}

export async function saveFinancialEntry(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(readEntryForm(formData));
  if (!parsed.success) return { status: "error", message: "Revise os dados da movimentação." };

  const access = await getFinanceClinic();
  if (!access.ok) return { status: "error", message: access.message };
  const { clinic } = access;

  const occurredAt = parseClinicDateOnly(parsed.data.occurredAt, clinic.timeZone);
  const dueDate = parsed.data.dueDate ? parseClinicDateOnly(parsed.data.dueDate, clinic.timeZone) : null;
  if (!occurredAt || (parsed.data.dueDate && !dueDate)) return { status: "error", message: "Informe datas válidas." };

  const payment = normalizeEntryPayment(parsed.data.status, parsed.data.amount, parsed.data.paidAmount);
  const data = {
    type: parsed.data.type,
    status: payment.status,
    description: parsed.data.description,
    category: parsed.data.category || null,
    amount: parsed.data.amount,
    paidAmount: payment.paidAmount,
    dueDate,
    occurredAt,
    notes: parsed.data.notes || null,
  };

  if (parsed.data.id) {
    // Lançamentos gerados por atendimentos (appointmentId) são somente leitura aqui.
    const updated = await prisma.financialEntry.updateMany({
      where: { id: parsed.data.id, clinicId: clinic.id, appointmentId: null },
      data,
    });
    if (!updated.count) return { status: "error", message: "Movimentação não encontrada." };
  } else {
    await prisma.financialEntry.create({ data: { ...data, clinicId: clinic.id } });
  }

  revalidatePath("/dashboard/financeiro");
  return { status: "success", message: parsed.data.id ? "Movimentação atualizada." : "Movimentação criada." };
}

export async function deleteFinancialEntry(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Movimentação inválida." };

  const access = await getFinanceClinic();
  if (!access.ok) return { status: "error", message: access.message };

  const result = await prisma.financialEntry.deleteMany({ where: { id: id.data, clinicId: access.clinic.id, appointmentId: null } });
  if (!result.count) return { status: "error", message: "Movimentação não encontrada." };

  revalidatePath("/dashboard/financeiro");
  return { status: "success", message: "Movimentação removida." };
}
