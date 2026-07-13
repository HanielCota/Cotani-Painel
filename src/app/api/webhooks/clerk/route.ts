import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: NextRequest) {
  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 400 });
  }

  if (event.type === "organization.created" || event.type === "organization.updated") {
    const organization = event.data;
    const slug = `${slugify(organization.name)}-${organization.id.slice(-6).toLowerCase()}`;

    await prisma.clinic.upsert({
      where: { clerkOrgId: organization.id },
      create: {
        clerkOrgId: organization.id,
        name: organization.name,
        slug,
      },
      update: {
        name: organization.name,
      },
    });
  }

  if (event.type === "organization.deleted") {
    const organization = event.data;

    if (organization.id) {
      await prisma.clinic.deleteMany({
        where: { clerkOrgId: organization.id },
      });
    }
  }

  return NextResponse.json({ received: true });
}
