"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/server/auth";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";

const schema = z.object({ id: z.uuid().optional(), type: z.enum(["INCOME", "EXPENSE"]), status: z.enum(["PENDING", "PARTIAL", "PAID", "REFUNDED", "CANCELED"]), description: z.string().trim().min(2).max(160), category: z.string().trim().max(80).optional(), amount: z.coerce.number().positive().max(1_000_000), paidAmount: z.coerce.number().min(0).max(1_000_000), dueDate: z.coerce.date().optional(), occurredAt: z.coerce.date(), notes: z.string().trim().max(1000).optional() });

function values(formData: FormData) { return { id: formData.get("id") || undefined, type: formData.get("type"), status: formData.get("status"), description: formData.get("description"), category: String(formData.get("category") ?? "").trim() || undefined, amount: formData.get("amount"), paidAmount: formData.get("paidAmount") || 0, dueDate: formData.get("dueDate") || undefined, occurredAt: formData.get("occurredAt"), notes: String(formData.get("notes") ?? "").trim() || undefined }; }
function normalizeStatus(status: "PENDING"|"PARTIAL"|"PAID"|"REFUNDED"|"CANCELED", amount: number, paid: number) { if (status === "REFUNDED" || status === "CANCELED") return { status, paidAmount: 0 }; if (paid <= 0) return { status: "PENDING" as const, paidAmount: 0 }; if (paid >= amount) return { status: "PAID" as const, paidAmount: amount }; return { status: "PARTIAL" as const, paidAmount: paid }; }
async function context() { await requireAuthenticatedUser(); const clinic = await getClinicForRoles(["ADMIN"]); if (!clinic) return { error: "Selecione uma loja." } as const; if (!isSubscriptionActive(clinic)) return { error: SUBSCRIPTION_INACTIVE_MESSAGE } as const; return { clinic } as const; }

export async function saveFinancialEntry(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(values(formData)); if (!parsed.success) return { status: "error", message: "Revise os dados da movimentação." };
  const access = await context(); if ("error" in access) return { status: "error", message: access.error ?? "Acesso indisponível." };
  const normalized = normalizeStatus(parsed.data.status, parsed.data.amount, parsed.data.paidAmount);
  const data = { type: parsed.data.type, status: normalized.status, description: parsed.data.description, category: parsed.data.category || null, amount: parsed.data.amount, paidAmount: normalized.paidAmount, dueDate: parsed.data.dueDate, occurredAt: parsed.data.occurredAt, notes: parsed.data.notes || null };
  if (parsed.data.id) { const existing = await prisma.financialEntry.findFirst({ where: { id: parsed.data.id, clinicId: access.clinic.id, appointmentId: null }, select: { id: true } }); if (!existing) return { status: "error", message: "Movimentação não encontrada." }; await prisma.financialEntry.update({ where: { id: existing.id }, data }); }
  else await prisma.financialEntry.create({ data: { ...data, clinicId: access.clinic.id } });
  revalidatePath("/dashboard/financeiro"); return { status: "success", message: parsed.data.id ? "Movimentação atualizada." : "Movimentação criada." };
}

export async function deleteFinancialEntry(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id")); if (!id.success) return { status: "error", message: "Movimentação inválida." };
  const access = await context(); if ("error" in access) return { status: "error", message: access.error ?? "Acesso indisponível." };
  const result = await prisma.financialEntry.deleteMany({ where: { id: id.data, clinicId: access.clinic.id, appointmentId: null } });
  if (!result.count) return { status: "error", message: "Movimentação não encontrada." };
  revalidatePath("/dashboard/financeiro"); return { status: "success", message: "Movimentação removida." };
}
