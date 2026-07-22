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
    expect(getByText("Total de agendamentos")).toBeInTheDocument();
    expect(getByText("120")).toBeInTheDocument();
    expect(getByText("Base de clientes")).toBeInTheDocument();
    expect(getByText("45")).toBeInTheDocument();
    expect(getByText("Serviços ativos")).toBeInTheDocument();
    expect(getByText("6")).toBeInTheDocument();
  });
});
