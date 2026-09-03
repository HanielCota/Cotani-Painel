import "server-only";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cache } from "react";

import prisma from "@/lib/prisma";
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export async function requireAuthenticatedUser(): Promise<SupabaseUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

/**
 * Sincroniza a identidade Supabase com o usuário da aplicação e aceita convites
 * pendentes pelo e-mail confirmado. O vínculo legado por e-mail preserva os
 * dados migrados do banco anterior sem reutilizar identificadores do antigo provedor.
 */
export const ensureCurrentAppUser = cache(async () => {
  const authUser = await requireAuthenticatedUser();
  const email = authUser.email?.trim().toLowerCase() ?? null;
  const name = getUserName(authUser);

  // O dashboard pode disparar várias renderizações de Server Components logo
  // após o login. Evite abrir uma transação interativa em cada uma delas: o
  // caminho comum (usuário já sincronizado ou cadastro realmente novo) é
  // idempotente e pode ser resolvido com operações simples.
  const [existingAppUser, pendingInvitation] = await Promise.all([
    prisma.user.findUnique({ where: { authUserId: authUser.id } }),
    email && authUser.email_confirmed_at
      ? prisma.clinicInvitation.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          status: "PENDING",
          expiresAt: { gt: new Date() },
          clinic: { deletedAt: null },
        },
        select: { id: true },
      })
      : Promise.resolve(null),
  ]);

  if (existingAppUser && !pendingInvitation) {
    const appUser = existingAppUser.email !== email || existingAppUser.name !== name
      ? await prisma.user.update({
          where: { id: existingAppUser.id },
          data: { email, name },
        })
      : existingAppUser;

    return { authUser, appUser };
  }

  if (!existingAppUser && !pendingInvitation) {
    const legacyUser = email && authUser.email_confirmed_at
      ? await prisma.user.findFirst({
          where: { authUserId: null, email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        })
      : null;

    if (!legacyUser) {
      const appUser = await prisma.user.upsert({
        where: { authUserId: authUser.id },
        create: { authUserId: authUser.id, email, name },
        update: { email, name },
      });

      return { authUser, appUser };
    }
  }

  return prisma.$transaction(async (transaction) => {
    let appUser = await transaction.user.findUnique({ where: { authUserId: authUser.id } });

    if (!appUser && email && authUser.email_confirmed_at) {
      const legacyUsers = await transaction.user.findMany({
        where: { authUserId: null, email: { equals: email, mode: "insensitive" } },
        include: { memberships: { include: { professional: true } } },
        orderBy: { createdAt: "asc" },
      });
      appUser = legacyUsers[0] ?? null;

      if (appUser && legacyUsers.length > 1) {
        for (const duplicate of legacyUsers.slice(1)) {
          for (const membership of duplicate.memberships) {
            const canonicalMembership = await transaction.membership.upsert({
              where: { clinicId_userId: { clinicId: membership.clinicId, userId: appUser.id } },
              create: { clinicId: membership.clinicId, userId: appUser.id, role: membership.role },
              update: {},
            });
            if (membership.professional && canonicalMembership.id !== membership.id) {
              const occupied = await transaction.professional.findUnique({ where: { membershipId: canonicalMembership.id } });
              await transaction.professional.update({
                where: { id: membership.professional.id },
                data: { membershipId: occupied ? null : canonicalMembership.id },
              });
            }
            if (canonicalMembership.id !== membership.id) {
              await transaction.membership.delete({ where: { id: membership.id } });
            }
          }
          await transaction.clinicInvitation.updateMany({ where: { invitedByUserId: duplicate.id }, data: { invitedByUserId: appUser.id } });
          await transaction.user.delete({ where: { id: duplicate.id } });
        }
      }
    }

    appUser = appUser
      ? await transaction.user.update({
          where: { id: appUser.id },
          data: { authUserId: authUser.id, email, name },
        })
      : await transaction.user.upsert({
          where: { authUserId: authUser.id },
          create: { authUserId: authUser.id, email, name },
          update: { email, name },
        });

    if (email && authUser.email_confirmed_at) {
      const invitations = await transaction.clinicInvitation.findMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          status: "PENDING",
          expiresAt: { gt: new Date() },
          clinic: { deletedAt: null },
        },
      });

      for (const invitation of invitations) {
        const membership = await transaction.membership.upsert({
          where: { clinicId_userId: { clinicId: invitation.clinicId, userId: appUser.id } },
          create: { clinicId: invitation.clinicId, userId: appUser.id, role: invitation.role },
          update: { role: invitation.role },
        });
        if (invitation.role === "PROVIDER" && invitation.professionalId) {
          const professional = await transaction.professional.findFirst({
            where: { id: invitation.professionalId, clinicId: invitation.clinicId, OR: [{ membershipId: null }, { membershipId: membership.id }] },
            select: { id: true },
          });
          if (professional) await transaction.professional.update({ where: { id: professional.id }, data: { membershipId: membership.id } });
        }
        await transaction.clinicInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date(), authUserId: authUser.id },
        });
      }

      await transaction.clinicInvitation.updateMany({
        where: { email: { equals: email, mode: "insensitive" }, status: "PENDING", expiresAt: { lte: new Date() } },
        data: { status: "EXPIRED" },
      });
    }

    return { authUser, appUser };
  }, { maxWait: 10_000, timeout: 20_000 });
});
