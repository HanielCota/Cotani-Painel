"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { ClinicRole } from "@/generated/prisma/enums";
import { provisionMembership } from "@/server/services/clinic-provisioning";

export interface SyncClinicResult {
  status: "success" | "error" | "no-org";
  message: string;
  clinicId?: string;
}

/**
 * Sincroniza a organização ativa do Clerk para o banco de dados local.
 * Cria Clinic, User e Membership quando o webhook ainda não processou
 * ou quando o tenant é acessado antes da sincronização automática.
 */
export async function syncActiveClinicFromClerk(): Promise<SyncClinicResult> {
  const { orgId, userId } = await auth.protect();

  if (!orgId) {
    return { status: "no-org", message: "Nenhuma barbearia selecionada no Clerk." };
  }

  const clerk = await clerkClient();

  let organization;
  try {
    organization = await clerk.organizations.getOrganization({ organizationId: orgId });
  } catch {
    return { status: "error", message: "Não foi possível buscar a organização no Clerk." };
  }

  let clerkUser;
  try {
    clerkUser = await clerk.users.getUser(userId);
  } catch {
    return { status: "error", message: "Não foi possível buscar o usuário no Clerk." };
  }

  try {
    const publicMetadata = organization.publicMetadata as Record<string, unknown> | undefined;

    const { clinic } = await provisionMembership({
      clinic: {
        clerkOrgId: organization.id,
        name: organization.name,
        publicMetadata,
      },
      user: {
        clerkUserId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
        name:
          clerkUser.firstName ??
          clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ??
          "Usuário",
      },
      role: ClinicRole.ADMIN,
    });

    return { status: "success", message: "Barbearia sincronizada.", clinicId: clinic.id };
  } catch {
    return { status: "error", message: "Não foi possível sincronizar a barbearia no banco de dados." };
  }
}
