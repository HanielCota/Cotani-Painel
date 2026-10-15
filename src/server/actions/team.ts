"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getAppOrigin } from "@/lib/url";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowClinicInvitation } from "@/server/services/action-rate-limit";
import { ensureCurrentAppUser } from "@/server/auth";
import { getTenantContext, requireRole } from "@/server/tenant";
import type { ActionResult } from "@/types";

/** Equipe da loja: convites, papéis e remoção de acessos. */

const ROLES = ["ADMIN", "RECEPTIONIST", "PROVIDER"] as const;
const INVITATION_TTL_MS = 60 * 60_000;

const inviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(ROLES),
  professionalId: z.uuid().optional(),
});
const membershipSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(ROLES).optional(),
  professionalId: z.uuid().optional(),
});
const invitationSchema = z.object({ invitationId: z.uuid() });

function revalidateTeam() {
  revalidatePath("/dashboard/negocio/equipe");
}

/** Convite do Supabase Auth; ao aceitar, a pessoa cria a senha em /update-password. */
async function sendInvitationEmail(email: string, invitationId: string) {
  return createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { name: email.split("@")[0], clinic_invitation_id: invitationId },
    redirectTo: `${await getAppOrigin()}/update-password`,
  });
}

export async function inviteClinicMember(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    professionalId: formData.get("professionalId") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Revise o e-mail e o papel do convite." };
  const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
  const { authUser, appUser } = await ensureCurrentAppUser();
  if (!(await allowClinicInvitation(tenant.clinic.id, authUser.id))) {
    return { status: "error", message: "Muitos convites enviados. Aguarde antes de tentar novamente." };
  }
  if (parsed.data.role === "PROVIDER" && !parsed.data.professionalId)
    return { status: "error", message: "Selecione qual profissional usará este acesso." };
  const selectedProfessional = parsed.data.professionalId
    ? await prisma.professional.findFirst({
        where: { id: parsed.data.professionalId, clinicId: tenant.clinic.id, isActive: true },
        select: { id: true, membershipId: true },
      })
    : null;
  if (parsed.data.professionalId && (!selectedProfessional || selectedProfessional.membershipId))
    return { status: "error", message: "O profissional selecionado não está disponível para vínculo." };

  // Quem já tem conta recebe o acesso direto, sem e-mail de convite.
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
  });
  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: { clinicId_userId: { clinicId: tenant.clinic.id, userId: existingUser.id } },
    });
    if (existingMembership) return { status: "error", message: "Este usuário já faz parte do negócio." };
    await prisma.$transaction(async (transaction) => {
      const membership = await transaction.membership.create({
        data: { clinicId: tenant.clinic.id, userId: existingUser.id, role: parsed.data.role },
      });
      if (selectedProfessional)
        await transaction.professional.update({
          where: { id: selectedProfessional.id },
          data: { membershipId: membership.id },
        });
    });
    revalidateTeam();
    return { status: "success", message: "Acesso adicionado à conta existente." };
  }

  await prisma.clinicInvitation.updateMany({
    where: { clinicId: tenant.clinic.id, email: { equals: parsed.data.email, mode: "insensitive" }, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  const invitation = await prisma.clinicInvitation.create({
    data: {
      clinicId: tenant.clinic.id,
      email: parsed.data.email,
      role: parsed.data.role,
      professionalId: selectedProfessional?.id,
      invitedByUserId: appUser.id,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });
  const { data, error } = await sendInvitationEmail(parsed.data.email, invitation.id);
  if (error) {
    const alreadyRegistered = `${error.code ?? ""} ${error.message}`
      .toLowerCase()
      .match(/already|registered|exists|existente/);
    if (alreadyRegistered) {
      revalidateTeam();
      return {
        status: "success",
        message:
          "Convite registrado. Como essa pessoa já possui conta, peça para ela entrar novamente com o mesmo e-mail.",
      };
    }
    await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
    return { status: "error", message: "Não foi possível enviar o convite. Tente novamente em instantes." };
  }
  await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { authUserId: data.user.id } });
  revalidateTeam();
  return { status: "success", message: "Convite enviado por e-mail." };
}

export async function updateClinicMemberRole(formData: FormData): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
    professionalId: formData.get("professionalId") || undefined,
  });
  if (!parsed.success || !parsed.data.role) return { status: "error", message: "Revise o papel informado." };
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, clinicId: clinic.id },
  });
  if (!membership) return { status: "error", message: "Membro não encontrado." };
  if (parsed.data.role === "PROVIDER" && !parsed.data.professionalId)
    return { status: "error", message: "Selecione o profissional vinculado." };
  const blockedLastAdmin = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return false;
    if (current.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) return true;
    }
    await transaction.professional.updateMany({ where: { membershipId: membership.id }, data: { membershipId: null } });
    await transaction.membership.update({ where: { id: membership.id }, data: { role: parsed.data.role } });
    if (parsed.data.role === "PROVIDER" && parsed.data.professionalId) {
      const professional = await transaction.professional.findFirst({
        where: {
          id: parsed.data.professionalId,
          clinicId: clinic.id,
          isActive: true,
          OR: [{ membershipId: null }, { membershipId: membership.id }],
        },
        select: { id: true },
      });
      if (!professional) throw new Error("Profissional indisponível para vínculo.");
      await transaction.professional.update({ where: { id: professional.id }, data: { membershipId: membership.id } });
    }
    return false;
  });
  if (blockedLastAdmin) return { status: "error", message: "O negócio precisa manter pelo menos um administrador." };
  revalidateTeam();
  return { status: "success", message: "Acesso atualizado." };
}

export async function removeClinicMember(formData: FormData): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse({ membershipId: formData.get("membershipId") });
  if (!parsed.success) return { status: "error", message: "Membro inválido." };
  const { clinic, membership: actorMembership } = requireRole(await getTenantContext(), ["ADMIN"]);
  const membership = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, clinicId: clinic.id },
  });
  if (!membership || membership.id === actorMembership.id)
    return { status: "error", message: "Você não pode remover seu próprio acesso." };
  const blockedLastAdmin = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const current = await transaction.membership.findFirst({ where: { id: membership.id, clinicId: clinic.id } });
    if (!current) return false;
    if (current.role === "ADMIN") {
      const adminCount = await transaction.membership.count({ where: { clinicId: clinic.id, role: "ADMIN" } });
      if (adminCount <= 1) return true;
    }
    await transaction.membership.delete({ where: { id: current.id } });
    return false;
  });
  if (blockedLastAdmin) return { status: "error", message: "Não é possível remover o último administrador." };
  revalidateTeam();
  return { status: "success", message: "Acesso removido." };
}

export async function revokeClinicInvitation(formData: FormData) {
  const parsed = invitationSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return;
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const invitation = await prisma.clinicInvitation.findFirst({
    where: { id: parsed.data.invitationId, clinicId: clinic.id, status: "PENDING" },
    select: { id: true, authUserId: true },
  });
  if (!invitation) return;
  await prisma.clinicInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
  // Remove a conta criada pelo convite se ela nunca foi confirmada e não há outro convite ativo.
  if (invitation.authUserId) {
    const remaining = await prisma.clinicInvitation.count({
      where: { authUserId: invitation.authUserId, status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (remaining === 0) {
      const supabase = createAdminClient();
      const { data } = await supabase.auth.admin.getUserById(invitation.authUserId);
      if (data.user && !data.user.email_confirmed_at) await supabase.auth.admin.deleteUser(invitation.authUserId);
    }
  }
  revalidateTeam();
}

export async function resendClinicInvitation(formData: FormData): Promise<ActionResult> {
  const parsed = invitationSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return { status: "error", message: "Convite inválido." };
  const { clinic } = requireRole(await getTenantContext(), ["ADMIN"]);
  const invitation = await prisma.clinicInvitation.findFirst({
    where: { id: parsed.data.invitationId, clinicId: clinic.id, status: "PENDING" },
  });
  if (!invitation) return { status: "error", message: "Convite não encontrado." };
  const { data, error } = await sendInvitationEmail(invitation.email, invitation.id);
  if (error) return { status: "error", message: "Não foi possível reenviar o convite agora." };
  await prisma.clinicInvitation.update({
    where: { id: invitation.id },
    data: { authUserId: data.user.id, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
  });
  revalidateTeam();
  return { status: "success", message: "Convite reenviado." };
}
