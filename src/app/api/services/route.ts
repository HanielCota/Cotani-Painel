import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export async function GET() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return NextResponse.json({ message: "Nenhuma barbearia selecionada." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!clinic) {
    return NextResponse.json({ message: "A barbearia ativa ainda não foi sincronizada." }, { status: 404 });
  }

  const services = await prisma.service.findMany({
    where: { clinicId: clinic.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(
    services.map((service) => ({
      id: service.id,
      name: service.name,
      duration: service.duration,
      price: Number(service.price),
      isActive: service.isActive,
    })),
  );
}
