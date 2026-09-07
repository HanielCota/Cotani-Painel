import "server-only";

import type { ReportAppointment } from "@/server/services/reports";
import { appointmentStatusLabel } from "@/lib/display-labels";

function escapeCsvCell(value: string | number): string {
  let normalized = String(value).replace(/\r?\n/g, " ");

  // Evita que Excel e similares interpretem dados do cliente como fórmula.
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;

  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildAppointmentsCsv(
  appointments: readonly ReportAppointment[],
  timeZone: string,
): string {
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const rows = appointments.map((appointment) => [
    dateFormatter.format(new Date(appointment.startTime)),
    appointment.customerName,
    appointment.serviceName,
    appointment.professionalName ?? "Sem profissional",
    appointmentStatusLabel(appointment.status),
    appointment.servicePrice.toFixed(2).replace(".", ","),
  ]);

  return [
    ["Data e horário", "Cliente", "Serviço", "Profissional", "Status", "Valor (R$)"],
    ...rows,
  ].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
}
