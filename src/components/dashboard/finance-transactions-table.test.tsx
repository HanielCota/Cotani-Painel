import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceTransactionsTable } from "@/components/dashboard/finance-transactions-table";
import type { FinanceAppointment } from "@/server/services/finance";
import { render } from "@/test/utils";

const appointments: FinanceAppointment[] = [
  {
    id: "app-1",
    customerName: "João Silva",
    serviceName: "Corte",
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
    serviceName: "Barba",
    professionalName: null,
    startTime: "2026-07-22T14:00:00.000Z",
    endTime: "2026-07-22T14:30:00.000Z",
    status: "CANCELED",
    servicePrice: 35,
    paymentMethod: "CASH",
  },
];

describe("FinanceTransactionsTable", () => {
  it("renderiza tabela com transações", () => {
    render(<FinanceTransactionsTable appointments={appointments} />);

    expect(screen.getByText("Transações recentes")).toBeInTheDocument();
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
  });

  it("não exibe valor para agendamentos cancelados", () => {
    render(<FinanceTransactionsTable appointments={appointments} />);

    const canceledRow = screen.getByText("Maria Souza").closest("tr");
    expect(canceledRow).toHaveTextContent("Cancelado");
    expect(canceledRow).not.toHaveTextContent("R$ 35,00");
  });

  it("renderiza empty state quando não há transações", () => {
    render(<FinanceTransactionsTable appointments={[]} />);

    expect(screen.getByText("Nenhuma transação no período selecionado.")).toBeInTheDocument();
  });
});
