import "server-only";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import type { ClinicInvitationModel } from "@/generated/prisma/models/ClinicInvitation";
import type { UserModel } from "@/generated/prisma/models/User";
import prisma from "@/lib/prisma";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { createClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("É necessário entrar na sua conta para continuar.");
    this.name = "AuthenticationRequiredError";
  }
}

function getUserName(user: SupabaseUser): string {
  const metadata = user.user_metadata as Record<string, unknown>;
  const candidate = metadata.full_name ?? metadata.name ?? metadata.display_name;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 120);
  return user.email?.split("@")[0]?.slice(0, 120) || "Usuário";
}

export const getAuthenticatedUser = cache(async (): Promise<SupabaseUser | null> => {
  if ((await cookies()).get("cotani_recovery_pending")?.value === "1") return null;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims || isRecoverySession(claimsData.claims)) return null;
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export async function requireAuthenticatedUser(): Promise<SupabaseUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export const requiresMfaVerification = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
});

export async function requireMfaAssurance(): Promise<void> {
  if (await requiresMfaVerification()) throw new AuthenticationRequiredError();
}

interface AppUserIdentity {
  authUserId: string;
  email: string | null;
  name: string;
}

type LegacyUserWithMemberships = Prisma.UserGetPayload<{
  include: { memberships: { include: { professional: true } } };
}>;
type LegacyMembership = LegacyUserWithMemberships["memberships"][number];

function hasConfirmedEmail(authUser: SupabaseUser, email: string | null): email is string {
  if (email == null || email.length === 0) return false;

  return authUser.email_confirmed_at != null && authUser.email_confirmed_at.length > 0;
}

function activeInvitationsFor(email: string) {
  return {
    email: { equals: email, mode: "insensitive" as const },
    status: "PENDING" as const,
    expiresAt: { gt: new Date() },
    clinic: { deletedAt: null },
  };
}

async function findPendingInvitation(authUser: SupabaseUser, email: string | null) {
  if (!hasConfirmedEmail(authUser, email)) return null;

  return prisma.clinicInvitation.findFirst({ where: activeInvitationsFor(email), select: { id: true } });
}

async function syncExistingAppUser(appUser: UserModel, identity: AppUserIdentity): Promise<UserModel> {
  if (appUser.email === identity.email && appUser.name === identity.name) return appUser;

  return prisma.user.update({
    where: { id: appUser.id },
    data: { email: identity.email, name: identity.name },
  });
}

/** Cria o usuário novo sem transação; devolve null quando há cadastro legado a vincular. */
async function createAppUserUnlessLegacy(authUser: SupabaseUser, identity: AppUserIdentity) {
  const legacyUser = hasConfirmedEmail(authUser, identity.email)
    ? await prisma.user.findFirst({
        where: { authUserId: null, email: { equals: identity.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null;

  if (legacyUser) return null;

  return prisma.user.upsert({
    where: { authUserId: identity.authUserId },
    create: { authUserId: identity.authUserId, email: identity.email, name: identity.name },
    update: { email: identity.email, name: identity.name },
  });
}

async function moveProfessionalToMembership(
  transaction: Prisma.TransactionClient,
  professionalId: string,
  membershipId: string,
) {
  const occupied = await transaction.professional.findUnique({ where: { membershipId } });

  await transaction.professional.update({
    where: { id: professionalId },
    data: { membershipId: occupied ? null : membershipId },
  });
}

async function moveMembershipToUser(
  transaction: Prisma.TransactionClient,
  membership: LegacyMembership,
  canonicalUserId: string,
) {
  const canonicalMembership = await transaction.membership.upsert({
    where: { clinicId_userId: { clinicId: membership.clinicId, userId: canonicalUserId } },
    create: { clinicId: membership.clinicId, userId: canonicalUserId, role: membership.role },
    update: {},
  });

  if (canonicalMembership.id === membership.id) return;

  if (membership.professional) {
    await moveProfessionalToMembership(transaction, membership.professional.id, canonicalMembership.id);
  }

  await transaction.membership.delete({ where: { id: membership.id } });
}

async function mergeDuplicateUser(
  transaction: Prisma.TransactionClient,
  duplicate: LegacyUserWithMemberships,
  canonicalUserId: string,
) {
  for (const membership of duplicate.memberships) {
    await moveMembershipToUser(transaction, membership, canonicalUserId);
  }

  await transaction.clinicInvitation.updateMany({
    where: { invitedByUserId: duplicate.id },
    data: { invitedByUserId: canonicalUserId },
  });
  await transaction.user.delete({ where: { id: duplicate.id } });
}

/** Escolhe o cadastro legado mais antigo do e-mail e funde os duplicados nele. */
async function claimLegacyUser(
  transaction: Prisma.TransactionClient,
  authUser: SupabaseUser,
  email: string | null,
): Promise<UserModel | null> {
  if (!hasConfirmedEmail(authUser, email)) return null;

  const legacyUsers = await transaction.user.findMany({
    where: { authUserId: null, email: { equals: email, mode: "insensitive" } },
    include: { memberships: { include: { professional: true } } },
    orderBy: { createdAt: "asc" },
  });
  const [canonicalUser, ...duplicates] = legacyUsers;

  if (canonicalUser == null) return null;

  for (const duplicate of duplicates) {
    await mergeDuplicateUser(transaction, duplicate, canonicalUser.id);
  }

  return canonicalUser;
}

async function saveLinkedAppUser(
  transaction: Prisma.TransactionClient,
  candidate: UserModel | null,
  identity: AppUserIdentity,
): Promise<UserModel> {
  const profile = { email: identity.email, name: identity.name };

  if (candidate) {
    return transaction.user.update({
      where: { id: candidate.id },
      data: { authUserId: identity.authUserId, ...profile },
    });
  }

  return transaction.user.upsert({
    where: { authUserId: identity.authUserId },
    create: { authUserId: identity.authUserId, ...profile },
    update: profile,
  });
}

async function linkInvitedProfessional(
  transaction: Prisma.TransactionClient,
  invitation: ClinicInvitationModel,
  membershipId: string,
) {
  if (invitation.role !== "PROVIDER" || !invitation.professionalId) return;

  const professional = await transaction.professional.findFirst({
    where: {
      id: invitation.professionalId,
      clinicId: invitation.clinicId,
      OR: [{ membershipId: null }, { membershipId }],
    },
    select: { id: true },
  });

  if (professional == null) return;

  await transaction.professional.update({ where: { id: professional.id }, data: { membershipId } });
}

interface InvitationAccepter {
  appUserId: string;
  authUserId: string;
}

async function acceptInvitation(
  transaction: Prisma.TransactionClient,
  invitation: ClinicInvitationModel,
  { appUserId, authUserId }: InvitationAccepter,
) {
  const membership = await transaction.membership.upsert({
    where: { clinicId_userId: { clinicId: invitation.clinicId, userId: appUserId } },
    create: { clinicId: invitation.clinicId, userId: appUserId, role: invitation.role },
    update: { role: invitation.role },
  });

  await linkInvitedProfessional(transaction, invitation, membership.id);
  await transaction.clinicInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), authUserId },
  });
}

async function acceptPendingInvitations(
  transaction: Prisma.TransactionClient,
  authUser: SupabaseUser,
  { email, appUserId }: { email: string | null; appUserId: string },
) {
  if (!hasConfirmedEmail(authUser, email)) return;

  const invitations = await transaction.clinicInvitation.findMany({ where: activeInvitationsFor(email) });

  for (const invitation of invitations) {
    await acceptInvitation(transaction, invitation, { appUserId, authUserId: authUser.id });
  }

  await transaction.clinicInvitation.updateMany({
    where: { email: { equals: email, mode: "insensitive" }, status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
}

async function linkAppUserInTransaction(
  transaction: Prisma.TransactionClient,
  authUser: SupabaseUser,
  identity: AppUserIdentity,
) {
  const currentAppUser = await transaction.user.findUnique({ where: { authUserId: identity.authUserId } });
  const candidate = currentAppUser ?? (await claimLegacyUser(transaction, authUser, identity.email));
  const appUser = await saveLinkedAppUser(transaction, candidate, identity);

  await acceptPendingInvitations(transaction, authUser, { email: identity.email, appUserId: appUser.id });

  return { authUser, appUser };
}

/**
 * Sincroniza a identidade Supabase com o usuário da aplicação e aceita convites
 * pendentes pelo e-mail confirmado. O vínculo legado por e-mail preserva os
 * dados migrados do banco anterior sem reutilizar identificadores do antigo provedor.
 */
export const ensureCurrentAppUser = cache(async () => {
  const authUser = await requireAuthenticatedUser();
  const identity: AppUserIdentity = {
    authUserId: authUser.id,
    email: authUser.email?.trim().toLowerCase() ?? null,
    name: getUserName(authUser),
  };

  // O dashboard pode disparar várias renderizações de Server Components logo
  // após o login. Evite abrir uma transação interativa em cada uma delas: o
  // caminho comum (usuário já sincronizado ou cadastro realmente novo) é
  // idempotente e pode ser resolvido com operações simples.
  const [existingAppUser, pendingInvitation] = await Promise.all([
    prisma.user.findUnique({ where: { authUserId: authUser.id } }),
    findPendingInvitation(authUser, identity.email),
  ]);

  if (existingAppUser && !pendingInvitation) {
    return { authUser, appUser: await syncExistingAppUser(existingAppUser, identity) };
  }

  if (!existingAppUser && !pendingInvitation) {
    const newAppUser = await createAppUserUnlessLegacy(authUser, identity);
    if (newAppUser) return { authUser, appUser: newAppUser };
  }

  return prisma.$transaction(
    (transaction) => linkAppUserInTransaction(transaction, authUser, identity),
    { maxWait: 10_000, timeout: 20_000 },
  );
});
