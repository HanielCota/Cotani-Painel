import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import type { ReportAppointment } from "@/server/services/reports";

interface ReportsAppointmentsTableProps {
  appointments: ReportAppointment[];
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  PENDING: "secondary",
  CONFIRMED: "success",
  COMPLETED: "default",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

export function ReportsAppointmentsTable({ appointments }: ReportsAppointmentsTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Nenhum agendamento no mês atual.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-card-foreground">Agendamentos do mês</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="pb-3 pl-2 font-medium">Data</th>
              <th className="pb-3 font-medium">Cliente</th>
              <th className="pb-3 font-medium">Serviço</th>
              <th className="pb-3 font-medium">Profissional</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 pr-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="text-foreground">
                <td className="py-3 pl-2 text-muted-foreground">
                  {format(new Date(appointment.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </td>
                <td className="py-3 font-medium text-foreground">{appointment.customerName}</td>
                <td className="py-3">{appointment.serviceName}</td>
                <td className="py-3 text-muted-foreground">{appointment.professionalName ?? "—"}</td>
                <td className="py-3">
                  <Badge variant={statusVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
                </td>
                <td className="py-3 pr-2 text-right font-semibold text-foreground">
                  {appointment.status === "CANCELED" || appointment.status === "NO_SHOW"
                    ? "—"
                    : priceFormatter.format(appointment.servicePrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
