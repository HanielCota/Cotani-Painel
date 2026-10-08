"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ClinicRole } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { writeAdminAuditLog } from "@/server/services/admin-audit";
import { moveClinicSlug, SlugInUseError } from "@/server/services/clinic-slug";

const clinicIdSchema = z.uuid();
const reasonSchema = z.string().trim().min(5).max(500);
const updateClinicSchema = z.object({
  clinicId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  timeZone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }),
  maxAppointmentsPerDay: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(1).max(1_000).optional(),
  ),
});
const clinicReasonSchema = z.object({ clinicId: z.uuid(), reason: reasonSchema });
const membershipRoleSchema = z.object({
  clinicId: z.uuid(),
  membershipId: z.uuid(),
  role: z.enum(ClinicRole),
  reason: reasonSchema,
});

function redirectToClinic(clinicId: string, status: "success" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/lojas/${clinicId}?${params.toString()}`);
}

function clinicSnapshot(clinic: {
  name: string;
  slug: string;
  timeZone: string;
  maxAppointmentsPerDay: number | null;
  operationalStatus: string;
  suspensionReason: string | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
}) {
  return {
    name: clinic.name,
    slug: clinic.slug,
    timeZone: clinic.timeZone,
    maxAppointmentsPerDay: clinic.maxAppointmentsPerDay,
    operationalStatus: clinic.operationalStatus,
    suspensionReason: clinic.suspensionReason,
    suspendedAt: clinic.suspendedAt?.toISOString() ?? null,
    deletedAt: clinic.deletedAt?.toISOString() ?? null,
  };
}

export async function updateClinicAsPlatformAdmin(formData: FormData): Promise<void> {
  const actor = await requirePlatformAdmin();
  const parsed = updateClinicSchema.safeParse({
    clinicId: formData.get("clinicId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    timeZone: formData.get("timeZone"),
    maxAppointmentsPerDay: formData.get("maxAppointmentsPerDay"),
  });
  if (!parsed.success) redirectToClinic(String(formData.get("clinicId") ?? ""), "error", "Revise os dados do negócio.");

  try {
    await prisma.$transaction(async (transaction) => {
      const before = await transaction.clinic.findUniqueOrThrow({ where: { id: parsed.data.clinicId } });
      // Mesma regra da tela da loja: respeita aliases de outras lojas e mantém
      // o endereço antigo funcionando para links já compartilhados.
      await moveClinicSlug(transaction, before, parsed.data.slug);
      const after = await transaction.clinic.update({
        where: { id: before.id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          timeZone: parsed.data.timeZone,
          maxAppointmentsPerDay: parsed.data.maxAppointmentsPerDay ?? null,
        },
      });
      await writeAdminAuditLog(transaction, actor, {
        action: "CLINIC_UPDATED",
        targetType: "Clinic",
        targetId: before.id,
        clinicId: before.id,
        beforeSnapshot: clinicSnapshot(before),
        afterSnapshot: clinicSnapshot(after),
      });
    });
  } catch (error) {
    redirectToClinic(parsed.data.clinicId, "error", error instanceof SlugInUseError
      ? "Esse slug já é usado por outro negócio (atual ou antigo)."
      : "Não foi possível atualizar. Verifique se o slug já está em uso.");
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/lojas/${parsed.data.clinicId}`);
  revalidatePath(`/${parsed.data.slug}`);
  redirectToClinic(parsed.data.clinicId, "success", "Negócio atualizado com sucesso.");
}

async function changeClinicLifecycle(
  formData: FormData,
  operation: "suspend" | "activate" | "delete" | "restore",
): Promise<void> {
  const actor = await requirePlatformAdmin();
  const parsed = clinicReasonSchema.safeParse({ clinicId: formData.get("clinicId"), reason: formData.get("reason") });
  if (!parsed.success) redirectToClinic(String(formData.get("clinicId") ?? ""), "error", "Informe um motivo com pelo menos 5 caracteres.");

  await prisma.$transaction(async (transaction) => {
    const before = await transaction.clinic.findUniqueOrThrow({ where: { id: parsed.data.clinicId } });
    const now = new Date();
    const data = operation === "suspend"
      ? { operationalStatus: "SUSPENDED" as const, suspensionReason: parsed.data.reason, suspendedAt: now }
      : operation === "activate"
        ? { operationalStatus: "ACTIVE" as const, suspensionReason: null, suspendedAt: null }
        : operation === "delete"
          ? { deletedAt: now, operationalStatus: "SUSPENDED" as const, suspensionReason: parsed.data.reason, suspendedAt: now }
          : { deletedAt: null, operationalStatus: "ACTIVE" as const, suspensionReason: null, suspendedAt: null };
    const after = await transaction.clinic.update({ where: { id: before.id }, data });
    const action = {
      suspend: "CLINIC_SUSPENDED",
      activate: "CLINIC_ACTIVATED",
      delete: "CLINIC_SOFT_DELETED",
      restore: "CLINIC_RESTORED",
    }[operation];
    await writeAdminAuditLog(transaction, actor, {
      action,
      targetType: "Clinic",
      targetId: before.id,
      clinicId: before.id,
      reason: parsed.data.reason,
      beforeSnapshot: clinicSnapshot(before),
      afterSnapshot: clinicSnapshot(after),
    });
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/lojas/${parsed.data.clinicId}`);
  redirectToClinic(parsed.data.clinicId, "success", {
    suspend: "Negócio suspenso.", activate: "Negócio reativado.", delete: "Negócio excluído de forma reversível.", restore: "Negócio restaurado.",
  }[operation]);
}

export async function suspendClinicAsPlatformAdmin(formData: FormData): Promise<void> {
  return changeClinicLifecycle(formData, "suspend");
}

export async function activateClinicAsPlatformAdmin(formData: FormData): Promise<void> {
  return changeClinicLifecycle(formData, "activate");
}

export async function deleteClinicAsPlatformAdmin(formData: FormData): Promise<void> {
  return changeClinicLifecycle(formData, "delete");
}

export async function restoreClinicAsPlatformAdmin(formData: FormData): Promise<void> {
  return changeClinicLifecycle(formData, "restore");
}

export async function updateMembershipRoleAsPlatformAdmin(formData: FormData): Promise<void> {
  const actor = await requirePlatformAdmin();
  const parsed = membershipRoleSchema.safeParse({
    clinicId: formData.get("clinicId"), membershipId: formData.get("membershipId"), role: formData.get("role"), reason: formData.get("reason"),
  });
  if (!parsed.success) redirectToClinic(String(formData.get("clinicId") ?? ""), "error", "Dados do vínculo inválidos.");

  const membership = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, clinicId: parsed.data.clinicId },
    include: { user: true, clinic: true },
  });
  if (!membership) redirectToClinic(parsed.data.clinicId, "error", "Vínculo não encontrado.");
  if (membership.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    const admins = await prisma.membership.count({ where: { clinicId: membership.clinicId, role: "ADMIN" } });
    if (admins <= 1) redirectToClinic(parsed.data.clinicId, "error", "O negócio precisa manter pelo menos um administrador.");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${membership.clinicId}, 0))`;
      if (membership.role === "ADMIN" && parsed.data.role !== "ADMIN") {
        const adminCount = await transaction.membership.count({ where: { clinicId: membership.clinicId, role: "ADMIN" } });
        if (adminCount <= 1) throw new Error("LAST_ADMIN");
      }
      // Mesmo contrato do fluxo da loja: quem deixa de ser PROVIDER perde o
      // vínculo com o profissional (a agenda filtrada por ele não se aplica mais).
      if (membership.role === "PROVIDER" && parsed.data.role !== "PROVIDER") {
        await transaction.professional.updateMany({ where: { membershipId: membership.id }, data: { membershipId: null } });
      }
      await transaction.membership.update({ where: { id: membership.id }, data: { role: parsed.data.role } });
      await writeAdminAuditLog(transaction, actor, {
        action: "MEMBERSHIP_ROLE_UPDATED",
        targetType: "Membership",
        targetId: membership.id,
        clinicId: membership.clinicId,
        reason: parsed.data.reason,
        beforeSnapshot: { userId: membership.user.authUserId, role: membership.role },
        afterSnapshot: { userId: membership.user.authUserId, role: parsed.data.role },
      });
    });
  } catch (error) {
    redirectToClinic(parsed.data.clinicId, "error", error instanceof Error && error.message === "LAST_ADMIN"
      ? "O negócio precisa manter pelo menos um administrador."
      : "Não foi possível alterar o papel do usuário.");
  }

  revalidatePath(`/admin/lojas/${parsed.data.clinicId}`);
  redirectToClinic(parsed.data.clinicId, "success", "Papel atualizado.");
}

export async function removeMembershipAsPlatformAdmin(formData: FormData): Promise<void> {
  const actor = await requirePlatformAdmin();
  const parsed = z.object({ clinicId: clinicIdSchema, membershipId: z.uuid(), reason: reasonSchema }).safeParse({
    clinicId: formData.get("clinicId"), membershipId: formData.get("membershipId"), reason: formData.get("reason"),
  });
  if (!parsed.success) redirectToClinic(String(formData.get("clinicId") ?? ""), "error", "Informe o motivo da remoção.");

  const membership = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, clinicId: parsed.data.clinicId },
    include: { user: true, clinic: true },
  });
  if (!membership) redirectToClinic(parsed.data.clinicId, "error", "Vínculo não encontrado.");
  if (membership.role === "ADMIN") {
    const admins = await prisma.membership.count({ where: { clinicId: membership.clinicId, role: "ADMIN" } });
    if (admins <= 1) redirectToClinic(parsed.data.clinicId, "error", "Não é possível remover o último administrador.");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${membership.clinicId}, 0))`;
      if (membership.role === "ADMIN") {
        const adminCount = await transaction.membership.count({ where: { clinicId: membership.clinicId, role: "ADMIN" } });
        if (adminCount <= 1) throw new Error("LAST_ADMIN");
      }
      await transaction.membership.delete({ where: { id: membership.id } });
      await writeAdminAuditLog(transaction, actor, {
        action: "MEMBERSHIP_REMOVED",
        targetType: "Membership",
        targetId: membership.id,
        clinicId: membership.clinicId,
        reason: parsed.data.reason,
        beforeSnapshot: { userId: membership.user.authUserId, role: membership.role },
      });
    });
  } catch (error) {
    redirectToClinic(parsed.data.clinicId, "error", error instanceof Error && error.message === "LAST_ADMIN"
      ? "Não é possível remover o último administrador."
      : "Não foi possível remover o vínculo.");
  }

  revalidatePath(`/admin/lojas/${parsed.data.clinicId}`);
  redirectToClinic(parsed.data.clinicId, "success", "Acesso removido.");
}
