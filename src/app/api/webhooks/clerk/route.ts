import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";

import { ClinicRole, SubscriptionStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
// Os membros da union declaram `type` como união de literais; o Extract precisa cobrir a união inteira.
type OrganizationEventData = Extract<ClerkWebhookEvent, { type: "organization.created" | "organization.updated" }>["data"];
type UserEventData = Extract<ClerkWebhookEvent, { type: "user.created" | "user.updated" }>["data"];
type DeletedUserEventData = Extract<ClerkWebhookEvent, { type: "user.deleted" }>["data"];
type MembershipEventData = Extract<
  ClerkWebhookEvent,
  { type: "organizationMembership.created" | "organizationMembership.updated" | "organizationMembership.deleted" }
>["data"];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapClerkRole(clerkRole: string): ClinicRole {
  return clerkRole === "org:admin" ? ClinicRole.ADMIN : ClinicRole.PROVIDER;
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

function getPrimaryEmail(user: UserEventData) {
  const primary = user.email_addresses.find((address) => address.id === user.primary_email_address_id);

  return (primary ?? user.email_addresses[0])?.email_address ?? null;
}

function getDisplayName(user: { first_name: string | null; last_name: string | null }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return name.length > 0 ? name : null;
}

async function upsertClinic(organization: OrganizationEventData, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const slug = `${slugify(organization.name)}-${organization.id.slice(-6).toLowerCase()}`;
  const metadata = organization.public_metadata as Record<string, unknown> | undefined;
  const subscriptionStatus = mapSubscriptionStatus(metadata?.subscription_status);

  return client.clinic.upsert({
    where: { clerkOrgId: organization.id },
    create: {
      clerkOrgId: organization.id,
      name: organization.name,
      slug,
      subscriptionStatus,
      hasPaidOnce: subscriptionStatus === SubscriptionStatus.ACTIVE,
    },
    update: {
      name: organization.name,
      subscriptionStatus,
      hasPaidOnce: subscriptionStatus === SubscriptionStatus.ACTIVE ? true : undefined,
    },
  });
}

async function upsertUser(user: UserEventData) {
  const email = getPrimaryEmail(user);
  const name = getDisplayName(user) ?? email ?? user.username ?? "Sem nome";

  await prisma.user.upsert({
    where: { clerkUserId: user.id },
    create: {
      clerkUserId: user.id,
      email,
      name,
    },
    update: {
      email,
      name,
    },
  });
}

async function deleteUser(user: DeletedUserEventData) {
  if (!user.id) {
    return;
  }

  await prisma.user.deleteMany({
    where: { clerkUserId: user.id },
  });
}

async function upsertMembership(data: MembershipEventData) {
  const clerkUserId = data.public_user_data.user_id;
  const identifier = data.public_user_data.identifier;
  // O identifier do Clerk pode ser e-mail, telefone ou username — só persistimos como e-mail o que tem formato de e-mail.
  const email = identifier.includes("@") ? identifier : null;
  const name = getDisplayName(data.public_user_data) ?? identifier;
  const role = mapClerkRole(data.role);

  await prisma.$transaction(async (transaction) => {
    // A barbearia é recriada aqui por segurança contra eventos fora de ordem
    // (organization.created pode não ter sido processado ainda).
    const clinic = await upsertClinic(data.organization, transaction);

    const user = await transaction.user.upsert({
      where: { clerkUserId },
      create: {
        clerkUserId,
        email,
        name,
      },
      // Os dados cadastrais do usuário são mantidos pelos eventos user.*;
      // aqui apenas garantimos que a linha exista.
      update: {},
    });

    await transaction.membership.upsert({
      where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
      create: {
        clinicId: clinic.id,
        userId: user.id,
        role,
      },
      update: {
        role,
      },
    });
  });
}

async function deleteMembership(data: MembershipEventData) {
  await prisma.membership.deleteMany({
    where: {
      clinic: { clerkOrgId: data.organization.id },
      user: { clerkUserId: data.public_user_data.user_id },
    },
  });
}

export async function POST(request: NextRequest) {
  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 400 });
  }

  switch (event.type) {
    case "organization.created":
    case "organization.updated":
      await upsertClinic(event.data);
      break;

    case "organization.deleted":
      if (event.data.id) {
        await prisma.clinic.deleteMany({
          where: { clerkOrgId: event.data.id },
        });
      }
      break;

    case "user.created":
    case "user.updated":
      await upsertUser(event.data);
      break;

    case "user.deleted":
      await deleteUser(event.data);
      break;

    case "organizationMembership.created":
    case "organizationMembership.updated":
      await upsertMembership(event.data);
      break;

    case "organizationMembership.deleted":
      await deleteMembership(event.data);
      break;
  }

  return NextResponse.json({ received: true });
}
