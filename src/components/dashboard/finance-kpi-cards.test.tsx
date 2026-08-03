import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceKpiCards } from "@/components/dashboard/finance-kpi-cards";
import { render } from "@/test/utils";

describe("FinanceKpiCards", () => {
  it("renderiza os quatro indicadores financeiros", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={3500}
        previousMonthRevenue={2800}
        monthAppointmentsTotal={42}
        monthConfirmedCount={30}
        monthCompletedCount={8}
        monthCanceledCount={3}
        monthNoShowCount={1}
      />,
    );

    expect(screen.getByText("Receita do mês")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*3\.500,00/)).toBeInTheDocument();

    expect(screen.getByText("Total de vendas")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*83,33/)).toBeInTheDocument();

    expect(screen.getByText("Cancelamentos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("exibe variação percentual positiva quando a receita cresceu", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={4000}
        previousMonthRevenue={2000}
        monthAppointmentsTotal={10}
        monthConfirmedCount={8}
        monthCompletedCount={2}
        monthCanceledCount={0}
        monthNoShowCount={0}
      />,
    );

    expect(screen.getByText("+100%")).toBeInTheDocument();
  });

  it("não exibe variação quando não há receita no mês anterior", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={1500}
        previousMonthRevenue={0}
        monthAppointmentsTotal={5}
        monthConfirmedCount={5}
        monthCompletedCount={0}
        monthCanceledCount={0}
        monthNoShowCount={0}
      />,
    );

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("renderiza micrográficos quando há séries de KPI", () => {
    const { container } = render(
      <FinanceKpiCards
        currentMonthRevenue={1500}
        previousMonthRevenue={1000}
        monthAppointmentsTotal={5}
        monthConfirmedCount={5}
        monthCompletedCount={0}
        monthCanceledCount={0}
        monthNoShowCount={0}
        kpiSeries={{
          revenue: [100, 200, 150],
          sales: [1, 2, 1],
          ticket: [100, 100, 150],
          cancellations: [0, 1, 0],
        }}
      />,
    );

    expect(container.querySelectorAll('[data-testid="sparkline"]').length).toBe(4);
  });
});
