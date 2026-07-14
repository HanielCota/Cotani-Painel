import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import type { CustomersPage } from "@/types";

const querySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: NextRequest) {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return NextResponse.json({ message: "Nenhuma clínica selecionada." }, { status: 400 });
  }

  const parsed = querySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Parâmetros de consulta inválidos." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!clinic) {
    return NextResponse.json({ message: "A clínica ativa ainda não foi sincronizada." }, { status: 404 });
  }

  const { search, page, pageSize } = parsed.data;
  const where = {
    clinicId: clinic.id,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const body: CustomersPage = {
    items: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };

  return NextResponse.json(body);
}
