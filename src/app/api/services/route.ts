import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getClinicForRoles } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "services");
  if (rateLimitResponse) return rateLimitResponse;

  const clinic = await getClinicForRoles(["ADMIN", "RECEPTIONIST"]);

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
