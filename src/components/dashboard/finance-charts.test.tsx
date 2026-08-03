import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MrrEvolutionChart,
  PaymentMethodsChart,
  PaymentStatusChart,
  SalesCalendarHeatmap,
  SalesPerformanceChart,
} from "@/components/dashboard/finance-charts";
import { render } from "@/test/utils";

describe("FinanceCharts", () => {
  it("renderiza gráfico de desempenho de vendas", () => {
    render(<SalesPerformanceChart data={[{ date: "21/07", value: 150 }]} />);
    expect(screen.getByText("Desempenho de vendas")).toBeInTheDocument();
  });

  it("renderiza gráfico de evolução mensal", () => {
    render(<MrrEvolutionChart data={[{ month: "Jul", revenue: 1500, ticket: 75 }]} />);
    expect(screen.getByText("Evolução (receita / ticket médio)")).toBeInTheDocument();
  });

  it("renderiza gráfico de métodos de pagamento", () => {
    render(
      <PaymentMethodsChart
        data={[{ name: "Pix", value: 60, color: "#8B5CF6" }]}
      />,
    );
    expect(screen.getByText("Métodos de pagamento")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
  });

  it("renderiza gráfico de status de pagamento", () => {
    render(
      <PaymentStatusChart
        data={[{ name: "Confirmado", value: 5, color: "#82D951" }]}
      />,
    );
    expect(screen.getByText("Status de pagamento")).toBeInTheDocument();
  });

  it("renderiza calendário de vendas", () => {
    render(
      <SalesCalendarHeatmap
        data={[
          { day: "Seg", values: [0, 100, 200, 0, 0, 0] },
        ]}
      />,
    );
    expect(screen.getByText("Calendário de vendas")).toBeInTheDocument();
  });
});
