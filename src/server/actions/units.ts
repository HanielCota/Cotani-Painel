"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { setActiveClinic } from "@/server/active-clinic";
import { findAvailableClinicSlug } from "@/server/services/clinic-provisioning";
import { isSubscriptionActive } from "@/server/subscription";
import { getTenantContext, requireRole } from "@/server/tenant";
import type { ActionResult } from "@/types";

/** Unidades adicionais do plano Empresa (lojas com `billingOwnerId`). */

const unitNameSchema = z.object({ name: z.string().trim().min(2).max(120) });
const unitSchema = z.object({ unitId: z.uuid(), name: z.string().trim().min(2).max(120).optional() });

const TENANT_ARCHIVE_REASON = "Arquivada pelo administrador da empresa";

type BillingOwnerState = Parameters<typeof isSubscriptionActive>[0] & {
  subscriptionPlan: Parameters<typeof getPlanEntitlements>[0];
  pendingSubscriptionPlan: Parameters<typeof getPlanEntitlements>[0] | null;
};

function multipleLocationsAllowed(owner: BillingOwnerState) {
  return isSubscriptionActive(owner)
    && getPlanEntitlements(owner.subscriptionPlan).multipleLocations
    && (!owner.pendingSubscriptionPlan || getPlanEntitlements(owner.pendingSubscriptionPlan).multipleLocations);
}

/** Unidade gerenciável: só por quem é ADMIN da loja principal (dona da cobrança). */
async function getManageableUnit(unitId: string) {
  const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
  const ownerId = tenant.clinic.billingOwnerId ?? tenant.clinic.id;
  const ownerMembership = await prisma.membership.findUnique({ where: { clinicId_userId: { clinicId: ownerId, userId: tenant.membership.userId } }, select: { role: true } });
  if (ownerMembership?.role !== "ADMIN") return null;
  const unit = await prisma.clinic.findFirst({ where: { id: unitId, billingOwnerId: ownerId } });
  return unit ? { tenant, ownerId, unit } : null;
}

export async function createEnterpriseUnit(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = unitNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: "Informe um nome válido para a unidade." };

  const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
  const ownerId = tenant.clinic.billingOwnerId ?? tenant.clinic.id;
  if (tenant.clinic.billingOwnerId) {
    const membership = await prisma.membership.findUnique({ where: { clinicId_userId: { clinicId: ownerId, userId: tenant.membership.userId } }, select: { role: true } });
    if (membership?.role !== "ADMIN") return { status: "error", message: "Somente um administrador da unidade principal pode criar unidades." };
  }
  const owner = ownerId === tenant.clinic.id
    ? tenant.clinic
    : await prisma.clinic.findUnique({ where: { id: ownerId } });
  if (!owner || !isSubscriptionActive(owner) || !getPlanEntitlements(owner.subscriptionPlan).multipleLocations) {
    return { status: "error", message: "Unidades adicionais estão disponíveis somente em uma assinatura Empresa ativa." };
  }

  const slug = await findAvailableClinicSlug(parsed.data.name);
  const created = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner.id}, 0))`;
    const currentOwner = await transaction.clinic.findUnique({ where: { id: owner.id } });
    if (!currentOwner || !multipleLocationsAllowed(currentOwner)) return null;
    const unit = await transaction.clinic.create({
      data: {
        name: parsed.data.name,
        slug,
        timeZone: tenant.clinic.timeZone,
        billingOwnerId: currentOwner.id,
        subscriptionStatus: currentOwner.subscriptionStatus,
        subscriptionPlan: currentOwner.subscriptionPlan,
        subscriptionCycle: currentOwner.subscriptionCycle,
        subscriptionExpiresAt: currentOwner.subscriptionExpiresAt,
        hasPaidOnce: currentOwner.hasPaidOnce,
      },
    });
    await transaction.membership.create({ data: { clinicId: unit.id, userId: tenant.membership.userId, role: "ADMIN" } });
    return unit;
  });
  if (!created) return { status: "error", message: "A assinatura Empresa não está mais ativa." };

  await setActiveClinic(created.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function updateEnterpriseUnit(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = unitSchema.safeParse({ unitId: formData.get("unitId"), name: formData.get("name") });
  if (!parsed.success || !parsed.data.name) return { status: "error", message: "Informe um nome válido." };
  const context = await getManageableUnit(parsed.data.unitId);
  if (!context) return { status: "error", message: "Unidade não encontrada ou sem permissão." };
  await prisma.clinic.update({ where: { id: context.unit.id }, data: { name: parsed.data.name } });
  revalidatePath("/dashboard/negocio/unidades");
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Unidade atualizada." };
}

export async function toggleEnterpriseUnitArchive(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(formData.get("unitId"));
  if (!parsed.success) return { status: "error", message: "Unidade inválida." };
  const context = await getManageableUnit(parsed.data);
  if (!context) return { status: "error", message: "Unidade não encontrada ou sem permissão." };
  // Suspensão/exclusão aplicada pela administração da plataforma não pode ser
  // desfeita (nem sobrescrita) pelo administrador da empresa.
  const { unit } = context;
  if (unit.operationalStatus !== "ACTIVE" && unit.suspensionReason !== TENANT_ARCHIVE_REASON) {
    return { status: "error", message: "Esta unidade foi suspensa pela equipe Cotani. Fale com o suporte para reativá-la." };
  }
  const archive = !unit.deletedAt;
  if (archive) {
    const future = await prisma.appointment.count({ where: { clinicId: unit.id, status: { in: ["PENDING", "CONFIRMED"] }, startTime: { gte: new Date() } } });
    if (future) return { status: "error", message: "Cancele ou reagende os atendimentos futuros antes de arquivar." };
    await prisma.clinic.update({ where: { id: unit.id }, data: { deletedAt: new Date(), operationalStatus: "SUSPENDED", suspendedAt: new Date(), suspensionReason: TENANT_ARCHIVE_REASON } });
    if (context.tenant.clinic.id === unit.id) await setActiveClinic(context.ownerId);
  } else {
    // Reativar volta a ocupar uma vaga de unidade: revalida o plano sob o mesmo
    // lock usado na criação, inclusive contra downgrade já agendado.
    const reactivated = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.ownerId}, 0))`;
      const owner = await transaction.clinic.findUnique({ where: { id: context.ownerId } });
      if (!owner || !multipleLocationsAllowed(owner)) return false;
      const updated = await transaction.clinic.updateMany({
        where: { id: unit.id, suspensionReason: TENANT_ARCHIVE_REASON },
        data: { deletedAt: null, operationalStatus: "ACTIVE", suspendedAt: null, suspensionReason: null },
      });
      return updated.count === 1;
    });
    if (!reactivated) return { status: "error", message: "Reativar unidades exige uma assinatura Empresa ativa, sem troca de plano agendada." };
  }
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: archive ? "Unidade arquivada." : "Unidade reativada." };
}

/** Copia horários e serviços ativos da loja principal para a unidade. */
export async function copyEnterpriseUnitSetup(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ unitId: z.uuid(), copyServices: z.boolean(), copyHours: z.boolean() }).safeParse({ unitId: formData.get("unitId"), copyServices: formData.get("copyServices") === "on", copyHours: formData.get("copyHours") === "on" });
  if (!parsed.success || (!parsed.data.copyServices && !parsed.data.copyHours)) return { status: "error", message: "Escolha o que deseja copiar." };
  const context = await getManageableUnit(parsed.data.unitId);
  if (!context || context.unit.deletedAt) return { status: "error", message: "Unidade inválida." };
  const unitId = context.unit.id;
  const [hours, services] = await Promise.all([
    prisma.businessHour.findMany({ where: { clinicId: context.ownerId } }),
    prisma.service.findMany({ where: { clinicId: context.ownerId, isActive: true } }),
  ]);
  await prisma.$transaction(async (transaction) => {
    if (parsed.data.copyHours) {
      for (const hour of hours) {
        const schedule = { isOpen: hour.isOpen, openTime: hour.openTime, closeTime: hour.closeTime, breakStart: hour.breakStart, breakEnd: hour.breakEnd };
        await transaction.businessHour.upsert({
          where: { clinicId_dayOfWeek: { clinicId: unitId, dayOfWeek: hour.dayOfWeek } },
          create: { clinicId: unitId, dayOfWeek: hour.dayOfWeek, ...schedule },
          update: schedule,
        });
      }
    }
    if (parsed.data.copyServices) {
      for (const service of services) {
        const exists = await transaction.service.findFirst({ where: { clinicId: unitId, name: { equals: service.name, mode: "insensitive" } } });
        if (!exists) await transaction.service.create({ data: { clinicId: unitId, name: service.name, duration: service.duration, price: service.price, imageUrl: service.imageUrl } });
      }
    }
  });
  revalidatePath("/dashboard/negocio/unidades");
  return { status: "success", message: "Configurações copiadas da unidade principal." };
}
