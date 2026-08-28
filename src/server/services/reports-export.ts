import type { ReportAppointment } from "@/server/services/reports";

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

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
    statusLabels[appointment.status] ?? appointment.status,
    appointment.servicePrice.toFixed(2).replace(".", ","),
  ]);

  return [
    ["Data e horário", "Cliente", "Serviço", "Profissional", "Status", "Valor (R$)"],
    ...rows,
  ].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
}
