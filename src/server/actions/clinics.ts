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
    if (!currentOwner || !isSubscriptionActive(currentOwner) || !getPlanEntitlements(currentOwner.subscriptionPlan).multipleLocations
      || (currentOwner.pendingSubscriptionPlan && !getPlanEntitlements(currentOwner.pendingSubscriptionPlan).multipleLocations)) {
      return null;
    }
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

export async function updateClinicMemberRole(formData: FormData) {
  const parsed = membershipSchema.safeParse({ membershipId: formData.get("membershipId"), role: formData.get("role"), professionalId: formData.get("professionalId") || undefined });
  if (!parsed.success || !parsed.data.role) return;
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({ where: { id: parsed.data.membershipId, clinicId: clinic.id } });
  if (!membership) return;
  if (parsed.data.role === "PROVIDER" && !parsed.data.professionalId) return;
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return;
    if (current.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) return;
    }
    await transaction.professional.updateMany({ where: { membershipId: membership.id }, data: { membershipId: null } });
    await transaction.membership.update({ where: { id: membership.id }, data: { role: parsed.data.role } });
    if (parsed.data.role === "PROVIDER" && parsed.data.professionalId) {
      const professional = await transaction.professional.findFirst({ where: { id: parsed.data.professionalId, clinicId: clinic.id, isActive: true, OR: [{ membershipId: null }, { membershipId: membership.id }] }, select: { id: true } });
      if (!professional) throw new Error("Profissional indisponível para vínculo.");
      await transaction.professional.update({ where: { id: professional.id }, data: { membershipId: membership.id } });
    }
  });
  revalidatePath("/dashboard/negocio/equipe");
}

export async function removeClinicMember(formData: FormData) {
  const parsed = membershipSchema.safeParse({ membershipId: formData.get("membershipId") });
  if (!parsed.success) return;
  const { clinic, membership: actorMembership } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({ where: { id: parsed.data.membershipId, clinicId: clinic.id } });
  if (!membership || membership.id === actorMembership.id) return;
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return;
    if (current.role === "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) return;
    }
    await transaction.membership.delete({ where: { id: current.id } });
  });
  revalidatePath("/dashboard/negocio/equipe");
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
