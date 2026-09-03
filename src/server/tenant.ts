import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import prisma from "@/lib/prisma";
import type { ClinicRole } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import type { MembershipModel } from "@/generated/prisma/models/Membership";
import { AuthenticationRequiredError, ensureCurrentAppUser } from "@/server/auth";

export const ACTIVE_CLINIC_COOKIE = "cotani_active_clinic";

/** Lançado quando não há loja ativa ou o vínculo do usuário ainda não foi sincronizado. */
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
 * Fail-closed: a identidade vem do Supabase e a associação à loja é sempre
 * validada no banco. Um cookie apenas sugere a loja ativa; ele nunca concede acesso.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const [{ appUser }, selectedClinicId] = await Promise.all([
    ensureCurrentAppUser(),
    getSelectedClinicId(),
  ]);

  let membership = await prisma.membership.findFirst({
    where: {
      userId: appUser.id,
      clinicId: selectedClinicId ?? undefined,
      clinic: { deletedAt: null },
    },
    include: { clinic: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership && selectedClinicId) {
    membership = await prisma.membership.findFirst({
      where: { userId: appUser.id, clinic: { deletedAt: null } },
      include: { clinic: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) {
    throw new TenantResolutionError("Nenhuma loja acessível foi encontrada para esta conta.");
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

/** Resolve o tenant e aplica RBAC sem esconder falhas de autenticação. */
export async function getClinicForRoles(roles: readonly ClinicRole[]) {
  try {
    const clinic = requireRole(await getTenantContext(), roles).clinic;
    return clinic.operationalStatus === "ACTIVE" && clinic.deletedAt === null ? clinic : null;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof TenantResolutionError || error instanceof InsufficientRoleError) {
      return null;
    }
    throw error;
  }
}

/**
 * Variante legada que retorna `null` em vez de lançar, usada pelas Server Actions
 * atuais que convertem a ausência de loja em `ActionResult` de erro.
 */
export async function requireActiveClinic() {
  try {
    const { clinic } = await getTenantContext();
    return clinic.deletedAt === null && clinic.operationalStatus === "ACTIVE" ? clinic : null;
  } catch (error) {
    if (error instanceof TenantResolutionError) return null;
    throw error;
  }
}

export type ApiTenantResult =
  | { ok: true; context: TenantContext }
  | { ok: false; status: 401 | 403 | 404; message: string };

/** Mantém 401, 403 e 404 distintos para Route Handlers privados. */
export async function getApiTenant(roles: readonly ClinicRole[]): Promise<ApiTenantResult> {
  try {
    const context = await getTenantContext();
    requireRole(context, roles);
    if (context.clinic.deletedAt || context.clinic.operationalStatus !== "ACTIVE") {
      return { ok: false, status: 404, message: "Loja ativa não encontrada." };
    }
    return { ok: true, context };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return { ok: false, status: 401, message: "Sua sessão expirou. Entre novamente." };
    }
    if (error instanceof InsufficientRoleError) {
      return { ok: false, status: 403, message: "Seu perfil não permite acessar este recurso." };
    }
    if (error instanceof TenantResolutionError) {
      return { ok: false, status: 404, message: "Loja ativa não encontrada." };
    }
    throw error;
  }
}

/** Retorna a preferência de loja ativa; a autorização ainda é validada no banco. */
export async function getSelectedClinicId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value ?? null;
}

export const getAvailableClinics = cache(async () => {
  const { appUser } = await ensureCurrentAppUser();
  return prisma.membership.findMany({
    where: { userId: appUser.id, clinic: { deletedAt: null } },
    include: { clinic: true },
    orderBy: [{ clinic: { name: "asc" } }, { createdAt: "asc" }],
  });
});
