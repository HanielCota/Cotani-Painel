import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toCsvRow } from "@/lib/csv";
import { getApiTenant } from "@/server/tenant";

const HEADER = ["nome", "telefone", "email", "proximo_retorno", "etiquetas", "observacoes"];

export async function GET() {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const customers = await prisma.customer.findMany({ where: { clinicId: tenant.context.clinic.id }, orderBy: { name: "asc" } });
  const rows = [
    HEADER.join(","),
    // Data sem horário: o dia correto é o de UTC (ver `parseClinicDateOnly`).
    ...customers.map((item) => toCsvRow([item.name, item.phone, item.email, item.nextReturnAt?.toISOString().slice(0, 10), item.tags.join(";"), item.notes])),
  ];
  return new NextResponse(`﻿${rows.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clientes.csv"', "Cache-Control": "private, no-store" } });
}
