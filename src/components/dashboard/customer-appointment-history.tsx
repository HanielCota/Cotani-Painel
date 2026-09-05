"use client";

import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";

interface CustomerAppointmentHistoryProps {
  appointments: Array<{
    id: string;
    dateTime: string;
    serviceName: string;
    professionalName: string;
    status: string;
  }>;
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export function CustomerAppointmentHistory({ appointments }: CustomerAppointmentHistoryProps) {
  const pagination = usePagination(appointments);

  if (appointments.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>;
  }

  return (
    <div>
      <div className="divide-y rounded-xl border">
        {pagination.pageItems.map((appointment) => (
          <div key={appointment.id} className="grid gap-1 p-4 text-sm sm:grid-cols-4">
            <span>{appointment.dateTime}</span>
            <span>{appointment.serviceName}</span>
            <span>{appointment.professionalName}</span>
            <Badge variant="outline" className="w-fit">{statusLabels[appointment.status] ?? appointment.status}</Badge>
          </div>
        ))}
      </div>
      <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={appointments.length} onPageChange={pagination.setPage} itemLabel="atendimento" />
    </div>
  );
}
