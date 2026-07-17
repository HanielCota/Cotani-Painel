import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  mapClerkRole,
  provisionMembership,
  softDeleteClinic,
  upsertClinic,
  upsertUser,
} from "@/server/services/clinic-provisioning";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type UserEventData = Extract<ClerkWebhookEvent, { type: "user.created" | "user.updated" }>["data"];
type DeletedUserEventData = Extract<ClerkWebhookEvent, { type: "user.deleted" }>["data"];
type MembershipEventData = Extract<
  ClerkWebhookEvent,
  {
    type: "organizationMembership.created" | "organizationMembership.updated" | "organizationMembership.deleted";
  }
>["data"];

function getPrimaryEmail(user: UserEventData) {
  const primary = user.email_addresses.find((address) => address.id === user.primary_email_address_id);

  return (primary ?? user.email_addresses[0])?.email_address ?? null;
}

function getDisplayName(user: { first_name: string | null; last_name: string | null }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return name.length > 0 ? name : null;
}

async function deleteUser(user: DeletedUserEventData) {
  if (!user.id) {
    return;
  }

  await prisma.user.deleteMany({
    where: { clerkUserId: user.id },
  });
}

async function deleteMembership(data: MembershipEventData) {
  await prisma.membership.deleteMany({
    where: {
      clinic: { clerkOrgId: data.organization.id, deletedAt: null },
      user: { clerkUserId: data.public_user_data.user_id },
    },
  });
}

export async function POST(request: NextRequest) {
  let event: ClerkWebhookEvent;

  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 400 });
  }

  const eventId = (event as unknown as { id: string }).id;
  const eventType = (event as unknown as { type: string }).type;

  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: "clerk",
        eventId,
      },
    },
  });

  if (existingEvent) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case "organization.created":
      case "organization.updated": {
        const organization = event.data;
        await upsertClinic({
          clerkOrgId: organization.id,
          name: organization.name,
          publicMetadata: organization.public_metadata as Record<string, unknown> | undefined,
        });
        break;
      }

      case "organization.deleted": {
        if (event.data.id) {
          await softDeleteClinic(event.data.id);
        }
        break;
      }

      case "user.created":
      case "user.updated": {
        const user = event.data;
        const email = getPrimaryEmail(user);
        const name = getDisplayName(user) ?? email ?? user.username ?? "Sem nome";

        await upsertUser({ clerkUserId: user.id, email, name });
        break;
      }

      case "user.deleted": {
        await deleteUser(event.data);
        break;
      }

      case "organizationMembership.created":
      case "organizationMembership.updated": {
        const data = event.data;
        const email = data.public_user_data.identifier.includes("@")
          ? data.public_user_data.identifier
          : null;
        const name = getDisplayName(data.public_user_data) ?? data.public_user_data.identifier;

        await provisionMembership({
          clinic: {
            clerkOrgId: data.organization.id,
            name: data.organization.name,
            publicMetadata: data.organization.public_metadata as Record<string, unknown> | undefined,
          },
          user: {
            clerkUserId: data.public_user_data.user_id,
            email,
            name,
          },
          role: mapClerkRole(data.role),
        });
        break;
      }

      case "organizationMembership.deleted": {
        await deleteMembership(event.data);
        break;
      }
    }

    await prisma.webhookEvent.create({
      data: {
        provider: "clerk",
        eventId,
        type: eventType,
        payloadSnapshot: event as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[clerk-webhook] Falha ao processar evento", {
      eventId,
      type: eventType,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ message: "Falha ao processar evento do webhook." }, { status: 500 });
  }
}
