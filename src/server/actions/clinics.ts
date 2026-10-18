"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { ensureCurrentAppUser } from "@/server/auth";
import { setActiveClinic } from "@/server/active-clinic";
import { findAvailableClinicSlug } from "@/server/services/clinic-provisioning";
import type { ActionResult } from "@/types";

// Unidades Empresa: ./units.ts. Equipe e convites: ./team.ts.

const clinicSchema = z.object({ name: z.string().trim().min(2).max(120) });
const switchSchema = z.object({ clinicId: z.uuid() });

/** Primeira loja da conta, com período grátis (uma vez por usuário). */
export async function createClinic(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = clinicSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: "Informe um nome válido para o negócio." };
  const { appUser } = await ensureCurrentAppUser();
  const slug = await findAvailableClinicSlug(parsed.data.name);
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${appUser.id}, 0))`;
    const [user, membershipCount] = await Promise.all([
      transaction.user.findUnique({ where: { id: appUser.id }, select: { trialStartedAt: true } }),
      transaction.membership.count({ where: { userId: appUser.id } }),
    ]);
    if (membershipCount > 0) return { ok: false, error: "Sua conta já possui um negócio. Unidades adicionais são liberadas somente no plano Empresa." } as const;
    if (user?.trialStartedAt) return { ok: false, error: "O período grátis desta conta já foi utilizado." } as const;
    const trialStartedAt = new Date();
    const created = await transaction.clinic.create({
      data: {
        name: parsed.data.name,
        slug,
        subscriptionStatus: "TRIALING",
        subscriptionPlan: "ESSENTIAL",
        subscriptionCycle: "MONTHLY",
        trialEndsAt: new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60_000),
      },
    });
    await transaction.membership.create({ data: { clinicId: created.id, userId: appUser.id, role: "ADMIN" } });
    await transaction.user.update({ where: { id: appUser.id }, data: { trialStartedAt } });
    return { ok: true, clinic: created } as const;
  });
  if (!result.ok) return { status: "error", message: result.error };
  await setActiveClinic(result.clinic.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Troca a loja ativa, somente para lojas em que a pessoa tem acesso. */
export async function switchActiveClinic(formData: FormData) {
  const parsed = switchSchema.safeParse({ clinicId: formData.get("clinicId") });
  if (!parsed.success) return;
  const { appUser } = await ensureCurrentAppUser();
  const allowed = await prisma.membership.findUnique({
    where: { clinicId_userId: { clinicId: parsed.data.clinicId, userId: appUser.id } },
    select: { id: true },
  });
  if (!allowed) return;
  await setActiveClinic(parsed.data.clinicId);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
