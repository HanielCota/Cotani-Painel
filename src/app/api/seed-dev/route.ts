import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { ClinicRole, SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

async function getClerk() {
  return clerkClient();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Garante que o e-mail do usuário esteja verified no Clerk.
 * Estratégia:
 * 1. Se o usuário não existe, cria sem e-mail e depois cria o e-mail já verificado.
 * 2. Se o usuário existe, verifica o e-mail primário existente.
 */
async function ensureVerifiedClerkUser(clerk: Awaited<ReturnType<typeof clerkClient>>, email: string) {
  const users = await clerk.users.getUserList({ emailAddress: [email] });
  const existing = users.data[0];

  if (existing) {
    const primaryEmailId = existing.primaryEmailAddressId;

    if (!primaryEmailId) {
      // Usuário existe sem e-mail primário — cria um verificado.
      const created = await clerk.emailAddresses.createEmailAddress({
        emailAddress: email,
        userId: existing.id,
        verified: true,
        primary: true,
      });
      return { clerkUserId: existing.id, emailVerified: created.verification?.status === "verified" };
    }

    const primaryEmail = existing.emailAddresses.find((item) => item.id === primaryEmailId);

    if (primaryEmail?.verification?.status === "verified") {
      return { clerkUserId: existing.id, emailVerified: true };
    }

    await clerk.emailAddresses.updateEmailAddress(primaryEmailId, { verified: true });
    return { clerkUserId: existing.id, emailVerified: true };
  }

  // Cria usuário sem e-mail para depois adicionar o e-mail já verificado.
  const newUser = await clerk.users.createUser({
    password: "cotani-dev-123",
  });

  const createdEmail = await clerk.emailAddresses.createEmailAddress({
    emailAddress: email,
    userId: newUser.id,
    verified: true,
    primary: true,
  });

  return { clerkUserId: newUser.id, emailVerified: createdEmail.verification?.status === "verified" };
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; name?: string };
  const { email, name: barbershopName } = body;

  if (!email || !barbershopName) {
    return NextResponse.json({ message: "Informe email e name no body." }, { status: 400 });
  }

  try {
    const clerk = await getClerk();

    // 1. Cria ou encontra usuário no Clerk com e-mail verificado
    const { clerkUserId, emailVerified } = await ensureVerifiedClerkUser(clerk, email);

    // 2. Cria organização
    const organization = await clerk.organizations.createOrganization({
      name: barbershopName,
      createdBy: clerkUserId,
      publicMetadata: { subscription_status: "active" },
    });

    // 3. O usuário criador já é adicionado como admin da organização pelo Clerk
    //    quando usamos createdBy, então não precisamos chamar createOrganizationMembership.

    // 4. Sincroniza no banco
    const slug = `${slugify(barbershopName)}-${organization.id.slice(-6).toLowerCase()}`;

    const clinic = await prisma.clinic.upsert({
      where: { clerkOrgId: organization.id },
      create: {
        clerkOrgId: organization.id,
        name: barbershopName,
        slug,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        hasPaidOnce: true,
      },
      update: {
        name: barbershopName,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        hasPaidOnce: true,
      },
    });

    const user = await prisma.user.upsert({
      where: { clerkUserId },
      create: { clerkUserId, email, name: email.split("@")[0] },
      update: { email, name: email.split("@")[0] },
    });

    await prisma.membership.upsert({
      where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
      create: { clinicId: clinic.id, userId: user.id, role: ClinicRole.ADMIN },
      update: { role: ClinicRole.ADMIN },
    });

    // 5. Cria expediente padrão
    const existingHours = await prisma.businessHour.count({ where: { clinicId: clinic.id } });

    if (existingHours === 0) {
      await prisma.businessHour.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          clinicId: clinic.id,
          dayOfWeek,
          isOpen: true,
          openTime: "08:00",
          closeTime: "18:00",
          breakStart: "12:00",
          breakEnd: "13:00",
        })),
      });
    }

    return NextResponse.json({
      message: "Barbearia de teste provisionada.",
      clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug },
      credentials: {
        email,
        password: "cotani-dev-123",
      },
      emailVerified,
      note: "Se o usuário já existia, a senha pode não ter sido alterada. Use o fluxo de recuperação se necessário.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[seed-dev] Falha ao provisionar barbearia de teste:", error);

    return NextResponse.json(
      { message: "Falha ao provisionar barbearia de teste.", error: message, stack },
      { status: 500 },
    );
  }
}
