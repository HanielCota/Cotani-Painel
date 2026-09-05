import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPlanEntitlements } from "@/config/subscription-plans";
import prisma from "@/lib/prisma";
import { parseClinicDateTime } from "@/lib/timezone";
import { getReportsMetrics } from "@/server/services/reports";
import { isSubscriptionActive } from "@/server/subscription";
import { getApiTenant } from "@/server/tenant";

export async function GET(request: NextRequest) {
  const tenant = await getApiTenant(["ADMIN"]); if (!tenant.ok) return NextResponse.json({ message: tenant.message }, { status: tenant.status });
  const { clinic } = tenant.context; const entitlements = getPlanEntitlements(clinic.subscriptionPlan);
  if (!isSubscriptionActive(clinic) || !entitlements.advancedReports) return NextResponse.json({ message: "Exportação indisponível para este plano." }, { status: 403 });
  const fromValue = request.nextUrl.searchParams.get("from"); const toValue = request.nextUrl.searchParams.get("to");
  const from = fromValue ? parseClinicDateTime(`${fromValue}T00:00`, clinic.timeZone) ?? undefined : undefined; const toStart = toValue ? parseClinicDateTime(`${toValue}T00:00`, clinic.timeZone) : null; const to = toStart ? new Date(toStart.getTime() + 86400000) : undefined;
  const ownerId = clinic.billingOwnerId ?? clinic.id; const clinicIds = (await prisma.clinic.findMany({ where: { OR: [{ id: ownerId }, { billingOwnerId: ownerId }], deletedAt: null }, select: { id: true } })).map((item) => item.id);
  const metrics = await getReportsMetrics(clinic, { from, to, clinicIds });
  const document = await PDFDocument.create(); const regular = await document.embedFont(StandardFonts.Helvetica); const bold = await document.embedFont(StandardFonts.HelveticaBold); const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  let page = document.addPage([595, 842]); let y = 790;
  const line = (text: string, size = 10, strong = false) => { if (y < 50) { page = document.addPage([595,842]); y=790; } page.drawText(text.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""), { x: 45, y, size, font: strong ? bold : regular, color: rgb(0.08,0.12,0.1) }); y -= size + 8; };
  page.drawRectangle({ x:0,y:812,width:595,height:30,color:rgb(0.04,0.65,0.48) }); line(`Cotani | Relatorio gerencial - ${clinic.name}`, 18, true); line(`Periodo: ${fromValue ?? "mes atual"} a ${toValue ?? "hoje"}`); y-=8;
  line(`Agendamentos: ${metrics.totalAppointments}`, 12, true); line(`Clientes ativos: ${metrics.activeCustomersThisMonth}`); line(`Receita concluida: ${money.format(metrics.completedRevenue)}`); line(`Ticket medio: ${money.format(metrics.averageTicket)}`); line(`Confirmacao: ${metrics.confirmationRate}% | Faltas: ${metrics.noShowRate}% | Cancelamentos: ${metrics.cancellationRate}% | Retencao: ${metrics.retentionRate}%`); y-=10;
  line("Agendamentos do periodo", 14, true);
  for (const item of metrics.monthAppointments) line(`${new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:clinic.timeZone }).format(new Date(item.startTime))} | ${item.customerName} | ${item.serviceName} | ${item.status} | ${money.format(item.servicePrice)}`);
  const bytes = await document.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type":"application/pdf", "Content-Disposition":'attachment; filename="relatorio-cotani.pdf"', "Cache-Control":"private, no-store" } });
}
