import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceKpiCards } from "@/components/dashboard/finance-kpi-cards";
import { render } from "@/test/utils";

describe("FinanceKpiCards", () => {
  it("renderiza os quatro indicadores financeiros", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={3500}
        expectedRevenue={1200}
        previousMonthRevenue={2800}
        monthAppointmentsTotal={42}
        monthPendingCount={4}
        monthConfirmedCount={30}
        monthCompletedCount={8}
        monthCanceledCount={3}
        monthNoShowCount={1}
      />,
    );

    expect(screen.getByText("Receita realizada")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*3\.500,00/)).toBeInTheDocument();

    expect(screen.getByText("Receita em aberto")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();

    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*437,50/)).toBeInTheDocument();

    expect(screen.getByText("Cancelamentos e faltas")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("exibe variação percentual positiva quando a receita cresceu", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={4000}
        expectedRevenue={800}
        previousMonthRevenue={2000}
        monthAppointmentsTotal={10}
        monthPendingCount={0}
        monthConfirmedCount={8}
        monthCompletedCount={2}
        monthCanceledCount={0}
        monthNoShowCount={0}
      />,
    );

    expect(screen.getByText("+100% vs. anterior")).toBeInTheDocument();
  });

  it("não exibe variação quando não há receita no mês anterior", () => {
    render(
      <FinanceKpiCards
        currentMonthRevenue={1500}
        expectedRevenue={500}
        previousMonthRevenue={0}
        monthAppointmentsTotal={5}
        monthPendingCount={0}
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
        expectedRevenue={500}
        previousMonthRevenue={1000}
        monthAppointmentsTotal={5}
        monthPendingCount={0}
        monthConfirmedCount={5}
        monthCompletedCount={0}
        monthCanceledCount={0}
        monthNoShowCount={0}
        kpiSeries={{
          revenue: [100, 200, 150],
          forecast: [200, 300, 100],
          ticket: [100, 100, 150],
          cancellations: [0, 1, 0],
        }}
      />,
    );

    expect(container.querySelectorAll('[data-testid="sparkline"]').length).toBe(4);
  });
});
