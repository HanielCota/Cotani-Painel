import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { orgId } = await auth.protect();

  const rateLimitResponse = await checkApiRateLimit(request, "services");
  if (rateLimitResponse) return rateLimitResponse;

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
      imageUrl: service.imageUrl,
      isActive: service.isActive,
    })),
  );
}
