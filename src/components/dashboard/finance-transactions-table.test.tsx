import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceTransactionsTable } from "@/components/dashboard/finance-transactions-table";
import type { FinanceAppointment } from "@/server/services/finance";
import { render } from "@/test/utils";

const appointments: FinanceAppointment[] = [
  {
    id: "app-1",
    customerName: "João Silva",
    serviceName: "Serviço A",
    professionalName: "Carlos",
    startTime: "2026-07-21T10:00:00.000Z",
    endTime: "2026-07-21T10:30:00.000Z",
    status: "CONFIRMED",
    servicePrice: 50,
    paymentMethod: "PIX",
  },
  {
    id: "app-2",
    customerName: "Maria Souza",
    serviceName: "Serviço B",
    professionalName: null,
    startTime: "2026-07-22T14:00:00.000Z",
    endTime: "2026-07-22T14:30:00.000Z",
    status: "CANCELED",
    servicePrice: 35,
    paymentMethod: "CASH",
  },
];

function table(appointments: FinanceAppointment[]) {
  return (
    <FinanceTransactionsTable
      data={{ items: appointments, total: appointments.length, page: 1, pageSize: 15 }}
      timeZone="America/Sao_Paulo"
      period="month"
      siblingPage={1}
    />
  );
}

describe("FinanceTransactionsTable", () => {
  it("renderiza tabela com transações", () => {
    render(table(appointments));

    expect(screen.getByText("Transações recentes")).toBeInTheDocument();
    expect(screen.getAllByText("João Silva")).toHaveLength(2);
    expect(screen.getAllByText("Maria Souza")).toHaveLength(2);
    expect(screen.getAllByText("Serviço A")).toHaveLength(2);
    expect(screen.getAllByText("Carlos")).toHaveLength(2);
    expect(screen.getAllByText("R$ 50,00")).toHaveLength(2);
  });

  it("não exibe valor para agendamentos cancelados", () => {
    render(table(appointments));

    const canceledRow = screen.getAllByText("Maria Souza")[0].closest("tr");
    expect(canceledRow).toHaveTextContent("Cancelado");
    expect(canceledRow).not.toHaveTextContent("R$ 35,00");
  });

  it("renderiza empty state quando não há transações", () => {
    render(table([]));

    expect(screen.getByText("Nenhuma transação no período selecionado.")).toBeInTheDocument();
  });
});
