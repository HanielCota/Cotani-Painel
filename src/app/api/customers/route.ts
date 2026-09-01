import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkApiRateLimit } from "@/lib/api-rate-limit";
import prisma from "@/lib/prisma";
import type { CustomersPage } from "@/types";
import { getApiTenant } from "@/server/tenant";

const querySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Parâmetros de consulta inválidos." }, { status: 400 });
  }

  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic } = tenant.context;
  const rateLimitResponse = await checkApiRateLimit(request, "customers");
  if (rateLimitResponse) return rateLimitResponse;

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
      include: {
        _count: { select: { appointments: true } },
        appointments: {
          where: { status: { not: "CANCELED" } },
          orderBy: { startTime: "desc" },
          take: 1,
          select: { startTime: true, service: { select: { name: true } } },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const body: CustomersPage = {
    items: customers.map((customer) => {
      const lastAppointment = customer.appointments[0] ?? null;
      const inactiveSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1_000);
      const relationship = !lastAppointment
        ? "NEW" as const
        : lastAppointment.startTime < inactiveSince
          ? "INACTIVE" as const
          : customer._count.appointments >= 2
            ? "RECURRING" as const
            : "ACTIVE" as const;

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.createdAt.toISOString(),
        appointmentCount: customer._count.appointments,
        lastAppointmentAt: lastAppointment?.startTime.toISOString() ?? null,
        lastServiceName: lastAppointment?.service.name ?? null,
        relationship,
      };
    }),
    total,
    page,
    pageSize,
  };

  return NextResponse.json(body);
}
