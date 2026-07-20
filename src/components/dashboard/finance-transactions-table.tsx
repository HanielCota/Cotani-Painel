"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import type { FinanceAppointment } from "@/server/services/finance";

interface FinanceTransactionsTableProps {
  appointments: FinanceAppointment[];
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

export function FinanceTransactionsTable({ appointments }: FinanceTransactionsTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-[#F3F4F6] bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Nenhuma transação no período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#F3F4F6] bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Transações recentes</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
              <th className="pb-3 pl-2 font-medium">Data</th>
              <th className="pb-3 font-medium">Cliente</th>
              <th className="pb-3 font-medium">Serviço</th>
              <th className="pb-3 font-medium">Profissional</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 pr-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="text-gray-700">
                <td className="py-3 pl-2 text-gray-500">
                  {format(new Date(appointment.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </td>
                <td className="py-3 font-medium text-gray-900">{appointment.customerName}</td>
                <td className="py-3">{appointment.serviceName}</td>
                <td className="py-3 text-gray-500">{appointment.professionalName ?? "—"}</td>
                <td className="py-3">
                  <Badge variant={statusVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
                </td>
                <td className="py-3 pr-2 text-right font-semibold text-gray-900">
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
