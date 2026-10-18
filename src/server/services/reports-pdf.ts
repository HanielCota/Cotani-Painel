import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { appointmentStatusLabel } from "@/lib/display-labels";
import { formatCurrency } from "@/lib/formatters";
import type { ReportAppointment, ReportsMetrics } from "@/server/services/reports";

const PAGE_SIZE: [number, number] = [595, 842];
const MARGIN_X = 45;
const TOP_Y = 790;
const BOTTOM_Y = 50;
const TEXT_COLOR = rgb(0.08, 0.12, 0.1);
const BRAND_COLOR = rgb(0.03, 0.45, 0.35);

/**
 * As fontes padrão do PDF só codificam WinAnsi: emoji ou símbolos (ex.: "→")
 * em nomes de clientes derrubariam a exportação inteira. Remove acentos e
 * descarta o que continuar fora do intervalo imprimível Latin-1.
 */
export function toPdfSafeText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fitToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && font.widthOfTextAtSize(`${text.slice(0, end)}...`, size) > maxWidth) end -= 1;
  return `${text.slice(0, end)}...`;
}

interface ReportPdfInput {
  clinicName: string;
  timeZone: string;
  periodLabel: string;
  metrics: ReportsMetrics;
  appointments: readonly ReportAppointment[];
}

export async function buildReportPdf({ clinicName, timeZone, periodLabel, metrics, appointments }: ReportPdfInput) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_SIZE[0] - MARGIN_X * 2;

  let page: PDFPage = document.addPage(PAGE_SIZE);
  let y = TOP_Y;
  const line = (text: string, size = 10, strong = false) => {
    if (y < BOTTOM_Y) {
      page = document.addPage(PAGE_SIZE);
      y = TOP_Y;
    }
    const font = strong ? bold : regular;
    page.drawText(fitToWidth(toPdfSafeText(text), font, size, maxWidth), { x: MARGIN_X, y, size, font, color: TEXT_COLOR });
    y -= size + 8;
  };
  const gap = (size: number) => { y -= size; };

  page.drawRectangle({ x: 0, y: 812, width: PAGE_SIZE[0], height: 30, color: BRAND_COLOR });
  line(`Cotani | Relatório gerencial - ${clinicName}`, 18, true);
  line(`Período: ${periodLabel}`);
  gap(8);

  line(`Agendamentos no período: ${metrics.periodAppointmentsTotal}`, 12, true);
  line(`Clientes ativos: ${metrics.activeCustomersThisMonth}`);
  line(`Receita concluída: ${formatCurrency(metrics.completedRevenue)}`);
  line(`Ticket médio: ${formatCurrency(metrics.averageTicket)}`);
  line(`Confirmação: ${metrics.confirmationRate}% | Faltas: ${metrics.noShowRate}% | Cancelamentos: ${metrics.cancellationRate}% | Retenção: ${metrics.retentionRate}%`);
  gap(10);

  line("Agendamentos do período", 14, true);
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
  if (appointments.length === 0) line("Nenhum agendamento no período.");
  for (const item of appointments) {
    line(`${dateFormatter.format(new Date(item.startTime))} | ${item.customerName} | ${item.serviceName} | ${appointmentStatusLabel(item.status)} | ${formatCurrency(item.servicePrice)}`);
  }

  return document.save();
}
