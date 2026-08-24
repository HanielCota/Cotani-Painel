import { cache } from "react";
import { auth } from "@clerk/nextjs/server";

import prisma from "@/lib/prisma";
import type { ClinicRole } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import type { MembershipModel } from "@/generated/prisma/models/Membership";

/** Lançado quando não há barbearia ativa ou o vínculo do usuário ainda não foi sincronizado. */
export class TenantResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

/** Lançado quando o papel do usuário não permite a operação. */
export class InsufficientRoleError extends Error {
  readonly role: ClinicRole;
  readonly required: readonly ClinicRole[];

  constructor(role: ClinicRole, required: readonly ClinicRole[]) {
    super(`O papel ${role} não permite esta operação. Necessário: ${required.join(", ")}.`);
    this.name = "InsufficientRoleError";
    this.role = role;
    this.required = required;
  }
}

export interface TenantContext {
  clinic: ClinicModel;
  membership: MembershipModel;
  role: ClinicRole;
}

/**
 * Contexto de tenant da requisição, memoizado por request via `cache()` do React.
 * Fail-closed: lança `TenantResolutionError` quando não há organização ativa
 * ou quando a barbearia/vínculo ainda não foi sincronizado pelo webhook do Clerk.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const { orgId, userId } = await auth.protect();

  if (!orgId) {
    throw new TenantResolutionError("Nenhuma barbearia ativa selecionada.");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      clinic: { clerkOrgId: orgId, deletedAt: null },
      user: { clerkUserId: userId },
    },
    include: { clinic: true },
  });

  if (!membership) {
    throw new TenantResolutionError("A barbearia ativa ou o vínculo do usuário ainda não foi sincronizado.");
  }

  return { clinic: membership.clinic, membership, role: membership.role };
});

/**
 * Guarda de autorização por papel. Lança `InsufficientRoleError` quando
 * `ctx.role` não está em `roles`. Retorna o próprio contexto para encadeamento.
 */
export function requireRole(ctx: TenantContext, roles: readonly ClinicRole[]): TenantContext {
  if (!roles.includes(ctx.role)) {
    throw new InsufficientRoleError(ctx.role, roles);
  }

  return ctx;
}

/** Resolve o tenant e aplica RBAC sem esconder falhas de autenticação do Clerk. */
export async function getClinicForRoles(roles: readonly ClinicRole[]) {
  try {
    const clinic = requireRole(await getTenantContext(), roles).clinic;
    return clinic.operationalStatus === "ACTIVE" && clinic.deletedAt === null ? clinic : null;
  } catch (error) {
    if (error instanceof TenantResolutionError || error instanceof InsufficientRoleError) {
      return null;
    }
    throw error;
  }
}

/**
 * Variante legada que retorna `null` em vez de lançar, usada pelas Server Actions
 * atuais que convertem a ausência de barbearia em `ActionResult` de erro.
 */
export async function requireActiveClinic() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return null;
  }

  const clinic = await prisma.clinic.findUnique({
    where: {
      clerkOrgId: orgId,
      deletedAt: null,
      operationalStatus: "ACTIVE",
    },
  });

  return clinic;
}

/** Retorna o orgId selecionado no Clerk sem buscar a barbearia no banco. */
export async function getSelectedOrgId(): Promise<string | null> {
  const { orgId } = await auth.protect();

  return orgId ?? null;
}
