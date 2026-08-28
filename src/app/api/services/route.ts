import { NextRequest, NextResponse } from "next/server";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic } = tenant.context;
  const rateLimitResponse = await checkApiRateLimit(request, "services");
  if (rateLimitResponse) return rateLimitResponse;

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
