"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowClinicInvitation } from "@/server/services/action-rate-limit";
import { ensureCurrentAppUser } from "@/server/auth";
import { getTenantContext, requireRole, ACTIVE_CLINIC_COOKIE } from "@/server/tenant";
import { slugify } from "@/server/services/clinic-provisioning";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { isSubscriptionActive } from "@/server/subscription";
import type { ActionResult } from "@/types";

const clinicSchema = z.object({ name: z.string().trim().min(2).max(120) });
const switchSchema = z.object({ clinicId: z.uuid() });
const inviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["ADMIN", "RECEPTIONIST", "PROVIDER"]),
  professionalId: z.uuid().optional(),
});
const membershipSchema = z.object({ membershipId: z.uuid(), role: z.enum(["ADMIN", "RECEPTIONIST", "PROVIDER"]).optional(), professionalId: z.uuid().optional() });
const invitationSchema = z.object({ invitationId: z.uuid() });
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

async function getManageableUnit(unitId: string) {
  const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
  const ownerId = tenant.clinic.billingOwnerId ?? tenant.clinic.id;
  const ownerMembership = await prisma.membership.findUnique({ where: { clinicId_userId: { clinicId: ownerId, userId: tenant.membership.userId } }, select: { role: true } });
  if (ownerMembership?.role !== "ADMIN") return null;
  const unit = await prisma.clinic.findFirst({ where: { id: unitId, billingOwnerId: ownerId } });
  return unit ? { tenant, ownerId, unit } : null;
}

function activeClinicCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "loja";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 6);
    const slug = `${base}-${suffix}`.slice(0, 120);
    if (!await prisma.clinic.findUnique({ where: { slug }, select: { id: true } })) return slug;
  }
  throw new Error("Não foi possível gerar um endereço único para a loja.");
}

export async function createClinic(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = clinicSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: "Informe um nome válido para a loja." };
  const { appUser } = await ensureCurrentAppUser();
  const slug = await uniqueSlug(parsed.data.name);
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${appUser.id}, 0))`;
    const [user, membershipCount] = await Promise.all([
      transaction.user.findUnique({ where: { id: appUser.id }, select: { trialStartedAt: true } }),
      transaction.membership.count({ where: { userId: appUser.id } }),
    ]);
    if (membershipCount > 0) return { ok: false, error: "Sua conta já possui uma loja. Unidades adicionais são liberadas somente no plano Empresa." } as const;
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
  const clinic = result.clinic;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE, clinic.id, activeClinicCookieOptions());
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createEnterpriseUnit(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = clinicSchema.safeParse({ name: formData.get("name") });
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

  const slug = await uniqueSlug(parsed.data.name);
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

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE, created.id, activeClinicCookieOptions());
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function switchActiveClinic(formData: FormData) {
  const parsed = switchSchema.safeParse({ clinicId: formData.get("clinicId") });
  if (!parsed.success) return;
  const { appUser } = await ensureCurrentAppUser();
  const allowed = await prisma.membership.findUnique({
    where: { clinicId_userId: { clinicId: parsed.data.clinicId, userId: appUser.id } },
    select: { id: true },
  });
  if (!allowed) return;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE, parsed.data.clinicId, activeClinicCookieOptions());
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

async function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function inviteClinicMember(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role"), professionalId: formData.get("professionalId") || undefined });
  if (!parsed.success) return { status: "error", message: "Revise o e-mail e o papel do convite." };
  const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
  const { authUser, appUser } = await ensureCurrentAppUser();
  if (!(await allowClinicInvitation(tenant.clinic.id, authUser.id))) {
    return { status: "error", message: "Muitos convites enviados. Aguarde antes de tentar novamente." };
  }
  if (parsed.data.role === "PROVIDER" && !parsed.data.professionalId) return { status: "error", message: "Selecione qual profissional usará este acesso." };
  const selectedProfessional = parsed.data.professionalId
    ? await prisma.professional.findFirst({ where: { id: parsed.data.professionalId, clinicId: tenant.clinic.id, isActive: true }, select: { id: true, membershipId: true } })
    : null;
  if (parsed.data.professionalId && (!selectedProfessional || selectedProfessional.membershipId)) return { status: "error", message: "O profissional selecionado não está disponível para vínculo." };
  const existingUser = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } } });
  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({ where: { clinicId_userId: { clinicId: tenant.clinic.id, userId: existingUser.id } } });
    if (existingMembership) return { status: "error", message: "Este usuário já faz parte da loja." };
    await prisma.$transaction(async (transaction) => {
      const membership = await transaction.membership.create({ data: { clinicId: tenant.clinic.id, userId: existingUser.id, role: parsed.data.role } });
      if (selectedProfessional) await transaction.professional.update({ where: { id: selectedProfessional.id }, data: { membershipId: membership.id } });
    });
    revalidatePath("/dashboard/negocio/equipe");
    return { status: "success", message: "Acesso adicionado à conta existente." };
  }

  await prisma.clinicInvitation.updateMany({
    where: { clinicId: tenant.clinic.id, email: { equals: parsed.data.email, mode: "insensitive" }, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  const invitation = await prisma.clinicInvitation.create({
    data: { clinicId: tenant.clinic.id, email: parsed.data.email, role: parsed.data.role, professionalId: selectedProfessional?.id, invitedByUserId: appUser.id, expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { name: parsed.data.email.split("@")[0], clinic_invitation_id: invitation.id },
    redirectTo: `${await appOrigin()}/update-password`,
  });
  if (error) {
    const alreadyRegistered = `${error.code ?? ""} ${error.message}`.toLowerCase().match(/already|registered|exists|existente/);
    if (alreadyRegistered) {
      revalidatePath("/dashboard/negocio/equipe");
      return { status: "success", message: "Convite registrado. Como essa pessoa já possui conta, peça para ela entrar novamente com o mesmo e-mail." };
    }
    await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
    return { status: "error", message: "Não foi possível enviar o convite. Tente novamente em instantes." };
  }
  await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { authUserId: data.user.id } });
  revalidatePath("/dashboard/negocio/equipe");
  return { status: "success", message: "Convite enviado por e-mail." };
}

export async function updateEnterpriseUnit(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = unitSchema.safeParse({ unitId: formData.get("unitId"), name: formData.get("name") });
  if (!parsed.success || !parsed.data.name) return { status: "error", message: "Informe um nome válido." };
  const context = await getManageableUnit(parsed.data.unitId);
  if (!context) return { status: "error", message: "Unidade não encontrada ou sem permissão." };
  await prisma.clinic.update({ where: { id: context.unit.id }, data: { name: parsed.data.name } });
  revalidatePath("/dashboard/negocio/unidades"); revalidatePath("/dashboard", "layout");
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
    if (context.tenant.clinic.id === unit.id) (await cookies()).set(ACTIVE_CLINIC_COOKIE, context.ownerId, activeClinicCookieOptions());
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

export async function copyEnterpriseUnitSetup(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ unitId: z.uuid(), copyServices: z.boolean(), copyHours: z.boolean() }).safeParse({ unitId: formData.get("unitId"), copyServices: formData.get("copyServices") === "on", copyHours: formData.get("copyHours") === "on" });
  if (!parsed.success || (!parsed.data.copyServices && !parsed.data.copyHours)) return { status: "error", message: "Escolha o que deseja copiar." };
  const context = await getManageableUnit(parsed.data.unitId);
  if (!context || context.unit.deletedAt) return { status: "error", message: "Unidade inválida." };
  const [hours, services] = await Promise.all([prisma.businessHour.findMany({ where: { clinicId: context.ownerId } }), prisma.service.findMany({ where: { clinicId: context.ownerId, isActive: true } })]);
  await prisma.$transaction(async (transaction) => {
    if (parsed.data.copyHours) for (const hour of hours) await transaction.businessHour.upsert({ where: { clinicId_dayOfWeek: { clinicId: context.unit.id, dayOfWeek: hour.dayOfWeek } }, create: { clinicId: context.unit.id, dayOfWeek: hour.dayOfWeek, isOpen: hour.isOpen, openTime: hour.openTime, closeTime: hour.closeTime, breakStart: hour.breakStart, breakEnd: hour.breakEnd }, update: { isOpen: hour.isOpen, openTime: hour.openTime, closeTime: hour.closeTime, breakStart: hour.breakStart, breakEnd: hour.breakEnd } });
    if (parsed.data.copyServices) for (const service of services) { const exists = await transaction.service.findFirst({ where: { clinicId: context.unit.id, name: { equals: service.name, mode: "insensitive" } } }); if (!exists) await transaction.service.create({ data: { clinicId: context.unit.id, name: service.name, duration: service.duration, price: service.price, imageUrl: service.imageUrl } }); }
  });
  revalidatePath("/dashboard/negocio/unidades");
  return { status: "success", message: "Configurações copiadas da unidade principal." };
}

export async function updateClinicMemberRole(formData: FormData): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({ membershipId: formData.get("membershipId"), role: formData.get("role"), professionalId: formData.get("professionalId") || undefined });
  if (!parsed.success || !parsed.data.role) return { status: "error", message: "Revise o papel informado." };
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({ where: { id: parsed.data.membershipId, clinicId: clinic.id } });
  if (!membership) return { status: "error", message: "Membro não encontrado." };
  if (parsed.data.role === "PROVIDER" && !parsed.data.professionalId) return { status: "error", message: "Selecione o profissional vinculado." };
  let blockedLastAdmin = false;
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return;
    if (current.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) { blockedLastAdmin = true; return; }
    }
    await transaction.professional.updateMany({ where: { membershipId: membership.id }, data: { membershipId: null } });
    await transaction.membership.update({ where: { id: membership.id }, data: { role: parsed.data.role } });
    if (parsed.data.role === "PROVIDER" && parsed.data.professionalId) {
      const professional = await transaction.professional.findFirst({ where: { id: parsed.data.professionalId, clinicId: clinic.id, isActive: true, OR: [{ membershipId: null }, { membershipId: membership.id }] }, select: { id: true } });
      if (!professional) throw new Error("Profissional indisponível para vínculo.");
      await transaction.professional.update({ where: { id: professional.id }, data: { membershipId: membership.id } });
    }
  });
  if (blockedLastAdmin) return { status: "error", message: "A empresa precisa manter pelo menos um administrador." };
  revalidatePath("/dashboard/negocio/equipe");
  return { status: "success", message: "Acesso atualizado." };
}

export async function removeClinicMember(formData: FormData): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({ membershipId: formData.get("membershipId") });
  if (!parsed.success) return { status: "error", message: "Membro inválido." };
  const { clinic, membership: actorMembership } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({ where: { id: parsed.data.membershipId, clinicId: clinic.id } });
  if (!membership || membership.id === actorMembership.id) return { status: "error", message: "Você não pode remover seu próprio acesso." };
  let blockedLastAdmin = false;
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return;
    if (current.role === "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) { blockedLastAdmin = true; return; }
    }
    await transaction.membership.delete({ where: { id: current.id } });
  });
  if (blockedLastAdmin) return { status: "error", message: "Não é possível remover o último administrador." };
  revalidatePath("/dashboard/negocio/equipe");
  return { status: "success", message: "Acesso removido." };
}

export async function revokeClinicInvitation(formData: FormData) {
  const parsed = invitationSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return;
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const invitation = await prisma.clinicInvitation.findFirst({ where: { id: parsed.data.invitationId, clinicId: clinic.id, status: "PENDING" }, select: { id: true, authUserId: true } });
  if (!invitation) return;
  await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
  if (invitation.authUserId) {
    const remaining = await prisma.clinicInvitation.count({ where: { authUserId: invitation.authUserId, status: "PENDING", expiresAt: { gt: new Date() } } });
    if (remaining === 0) {
      const supabase = createAdminClient();
      const { data } = await supabase.auth.admin.getUserById(invitation.authUserId);
      if (data.user && !data.user.email_confirmed_at) await supabase.auth.admin.deleteUser(invitation.authUserId);
    }
  }
  revalidatePath("/dashboard/negocio/equipe");
}

export async function resendClinicInvitation(formData: FormData): Promise<ActionResult> {
  const parsed = invitationSchema.safeParse({ invitationId: formData.get("invitationId") }); if (!parsed.success) return { status: "error", message: "Convite inválido." };
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]); const invitation = await prisma.clinicInvitation.findFirst({ where: { id: parsed.data.invitationId, clinicId: clinic.id, status: "PENDING" } }); if (!invitation) return { status: "error", message: "Convite não encontrado." };
  const supabase = createAdminClient(); const { data, error } = await supabase.auth.admin.inviteUserByEmail(invitation.email, { data: { name: invitation.email.split("@")[0], clinic_invitation_id: invitation.id }, redirectTo: `${await appOrigin()}/update-password` }); if (error) return { status: "error", message: "Não foi possível reenviar o convite agora." };
  await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { authUserId: data.user.id, expiresAt: new Date(Date.now() + 60 * 60_000) } }); revalidatePath("/dashboard/negocio/equipe"); return { status: "success", message: "Convite reenviado." };
}
