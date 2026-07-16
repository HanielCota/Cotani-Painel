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

    // 1. Cria ou encontra usuário no Clerk
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    let clerkUserId = users.data[0]?.id;

    let emailVerified = false;

    if (!clerkUserId) {
      const newUser = await clerk.users.createUser({
        emailAddress: [email],
        password: "cotani-dev-123",
      });
      clerkUserId = newUser.id;

      if (newUser.primaryEmailAddressId) {
        await clerk.emailAddresses.updateEmailAddress(newUser.primaryEmailAddressId, { verified: true });
        emailVerified = true;
      }
    } else {
      const existingUser = await clerk.users.getUser(clerkUserId);
      if (existingUser.primaryEmailAddressId) {
        await clerk.emailAddresses.updateEmailAddress(existingUser.primaryEmailAddressId, { verified: true });
        emailVerified = true;
      }
    }

    // 2. Cria organização
    const organization = await clerk.organizations.createOrganization({
      name: barbershopName,
      createdBy: clerkUserId,
      publicMetadata: { subscription_status: "active" },
    });

    // 3. Adiciona usuário como admin da organização
    await clerk.organizations.createOrganizationMembership({
      organizationId: organization.id,
      userId: clerkUserId,
      role: "org:admin",
    });

    // 4. Sincroniza no banco
    const slug = `${slugify(barbershopName)}-${organization.id.slice(-6).toLowerCase()}`;

    const clinic = await prisma.clinic.upsert({
      where: { clerkOrgId: organization.id },
      create: {
        clerkOrgId: organization.id,
        name: barbershopName,
        slug,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
      update: {
        name: barbershopName,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
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

    return NextResponse.json({ message: "Falha ao provisionar barbearia de teste.", error: message }, { status: 500 });
  }
}
