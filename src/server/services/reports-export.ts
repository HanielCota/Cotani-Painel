import "server-only";

import type { ReportAppointment } from "@/server/services/reports";
import { appointmentStatusLabel } from "@/lib/display-labels";
import { toCsvRow } from "@/lib/csv";

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
  ].map((row) => toCsvRow(row, ";")).join("\r\n");
}
