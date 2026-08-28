import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic } = tenant.context;
  const rateLimitResponse = await checkApiRateLimit(request, "professionals");
  if (rateLimitResponse) return rateLimitResponse;

  const professionals = await prisma.professional.findMany({
    where: { clinicId: clinic.id },
    include: {
      services: {
        select: { serviceId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    professionals.map((professional) => ({
      id: professional.id,
      name: professional.name,
      imageUrl: professional.imageUrl,
      isActive: professional.isActive,
      serviceIds: professional.services.map((relation) => relation.serviceId),
    })),
  );
}
