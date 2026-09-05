import { describe, expect, it } from "vitest";

import { ReportsKpiCards } from "@/components/dashboard/reports-kpi-cards";
import { render } from "@/test/utils";
import type { ReportsMetrics } from "@/server/services/reports";

const baseMetrics: ReportsMetrics = {
  totalAppointments: 120,
  totalCustomers: 45,
  totalServices: 6,
  activeCustomersThisMonth: 30,
  confirmationRate: 85,
  noShowRate: 5,
  cancellationRate: 4,
  completedRevenue: 3_000,
  averageTicket: 100,
  returningCustomers: 12,
  retentionRate: 40,
  noShowsByWeekday: [],
  confirmationsByChannel: [],
  monthlyData: [],
  topServices: [],
  topProfessionals: [],
  monthAppointments: [],
};

describe("ReportsKpiCards", () => {
  it("renderiza todos os KPIs com os valores corretos", () => {
    const { getByText } = render(<ReportsKpiCards metrics={baseMetrics} />);

    expect(getByText("Taxa de confirmação")).toBeInTheDocument();
    expect(getByText("85%")).toBeInTheDocument();
    expect(getByText("Taxa de falta")).toBeInTheDocument();
    expect(getByText("5%")).toBeInTheDocument();
    expect(getByText("Clientes ativos no mês")).toBeInTheDocument();
    expect(getByText("30")).toBeInTheDocument();
    expect(getByText("Receita concluída")).toBeInTheDocument();
    expect(getByText(/R\$\s*3\.000,00/)).toBeInTheDocument();
    expect(getByText("Ticket médio")).toBeInTheDocument();
    expect(getByText(/R\$\s*100,00/)).toBeInTheDocument();
    expect(getByText("Taxa de cancelamento")).toBeInTheDocument();
    expect(getByText("4%")).toBeInTheDocument();
    expect(getByText("Clientes recorrentes")).toBeInTheDocument();
    expect(getByText("12")).toBeInTheDocument();
  });
});
