import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getApiTenant } from "@/server/tenant";

function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export async function GET() {
  const tenant = await getApiTenant(["ADMIN", "RECEPTIONIST"]);
  if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const customers = await prisma.customer.findMany({ where: { clinicId: tenant.context.clinic.id }, orderBy: { name: "asc" } });
  const rows = ["nome,telefone,email,proximo_retorno,etiquetas,observacoes", ...customers.map((item) => [item.name, item.phone, item.email, item.nextReturnAt?.toISOString().slice(0, 10), item.tags.join(";"), item.notes].map(csv).join(","))];
  return new NextResponse(`\uFEFF${rows.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clientes.csv"', "Cache-Control": "private, no-store" } });
}
