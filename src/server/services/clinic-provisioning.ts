import { ClinicRole, SubscriptionStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateClinicSlug(name: string, clerkOrgId: string) {
  return `${slugify(name)}-${clerkOrgId.slice(-6).toLowerCase()}`;
}

export function mapSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (typeof value !== "string") {
    return SubscriptionStatus.INACTIVE;
  }

  const normalized = value.toUpperCase();

  if (normalized === "ACTIVE") return SubscriptionStatus.ACTIVE;
  if (normalized === "PAST_DUE") return SubscriptionStatus.PAST_DUE;
  if (normalized === "CANCELED") return SubscriptionStatus.CANCELED;

  return SubscriptionStatus.INACTIVE;
}

export function mapClerkRole(clerkRole: string): ClinicRole {
  if (clerkRole === "org:admin") return ClinicRole.ADMIN;
  if (clerkRole === "org:receptionist") return ClinicRole.RECEPTIONIST;
  return ClinicRole.PROVIDER;
}

interface ClinicProvisioningInput {
  clerkOrgId: string;
  name: string;
  publicMetadata?: Record<string, unknown>;
}

export async function upsertClinic(
  input: ClinicProvisioningInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const slug = generateClinicSlug(input.name, input.clerkOrgId);
  const subscriptionStatus = mapSubscriptionStatus(input.publicMetadata?.subscription_status);

  return client.clinic.upsert({
    where: { clerkOrgId: input.clerkOrgId },
    create: {
      clerkOrgId: input.clerkOrgId,
      name: input.name,
      slug,
      subscriptionStatus,
      hasPaidOnce: subscriptionStatus === SubscriptionStatus.ACTIVE,
    },
    update: {
      name: input.name,
      subscriptionStatus,
      hasPaidOnce: subscriptionStatus === SubscriptionStatus.ACTIVE ? true : undefined,
    },
  });
}

interface UserProvisioningInput {
  clerkUserId: string;
  email: string | null;
  name: string;
}

export async function upsertUser(
  input: UserProvisioningInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.user.upsert({
    where: { clerkUserId: input.clerkUserId },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
    },
    update: {
      email: input.email,
      name: input.name,
    },
  });
}

interface MembershipProvisioningInput {
  clinic: ClinicProvisioningInput;
  user: UserProvisioningInput;
  role: ClinicRole;
}

export async function provisionMembership(input: MembershipProvisioningInput) {
  return prisma.$transaction(async (transaction) => {
    const clinic = await upsertClinic(input.clinic, transaction);
    const user = await upsertUser(input.user, transaction);

    await transaction.membership.upsert({
      where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
      create: {
        clinicId: clinic.id,
        userId: user.id,
        role: input.role,
      },
      update: {
        role: input.role,
      },
    });

    return { clinic, user };
  });
}

export async function softDeleteClinic(clerkOrgId: string) {
  await prisma.clinic.updateMany({
    where: { clerkOrgId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
