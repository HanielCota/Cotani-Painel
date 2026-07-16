"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import type { ActionResult } from "@/types";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (typeof value !== "string") {
    return SubscriptionStatus.INACTIVE;
  }

  const normalized = value.toUpperCase();

  if (normalized === "ACTIVE") return SubscriptionStatus.ACTIVE;
  if (normalized === "PAST_DUE") return SubscriptionStatus.PAST_DUE;
  if (normalized === "CANCELED") return SubscriptionStatus.CANCELED;

  return SubscriptionStatus.INACTIVE;
}

export async function syncActiveClinic(): Promise<ActionResult> {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return { status: "error", message: "Nenhuma barbearia selecionada no Clerk." };
  }

  const clerk = await clerkClient();

  let organization;

  try {
    organization = await clerk.organizations.getOrganization({ organizationId: orgId });
  } catch {
    return { status: "error", message: "Não foi possível buscar a organização no Clerk." };
  }

  const metadata = organization.publicMetadata as Record<string, unknown> | undefined;
  const subscriptionStatus = mapSubscriptionStatus(metadata?.subscription_status);
  const slug = `${slugify(organization.name)}-${organization.id.slice(-6).toLowerCase()}`;

  try {
    await prisma.clinic.upsert({
      where: { clerkOrgId: organization.id },
      create: {
        clerkOrgId: organization.id,
        name: organization.name,
        slug,
        subscriptionStatus,
      },
      update: {
        name: organization.name,
        subscriptionStatus,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível sincronizar a barbearia no banco de dados." };
  }

  revalidatePath("/dashboard");

  return { status: "success", message: "Barbearia sincronizada. Recarregue a página." };
}
