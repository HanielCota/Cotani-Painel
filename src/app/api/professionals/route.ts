import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireActiveClinic } from "@/server/tenant";

export async function GET() {
  const clinic = await requireActiveClinic();

  if (!clinic) {
    return NextResponse.json({ message: "Selecione uma barbearia." }, { status: 403 });
  }

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
