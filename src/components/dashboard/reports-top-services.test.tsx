import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportsTopServices } from "@/components/dashboard/reports-top-services";
import { render } from "@/test/utils";

const services = [
  { name: "Serviço A", count: 12, revenue: 600 },
  { name: "Serviço B", count: 8, revenue: 280 },
  { name: "Sobrancelha", count: 3, revenue: 90 },
];

describe("ReportsTopServices", () => {
  it("renderiza título e lista de serviços", () => {
    render(<ReportsTopServices services={services} />);

    expect(screen.getByText("Serviços mais vendidos")).toBeInTheDocument();
    expect(screen.getByText("Serviço A")).toBeInTheDocument();
    expect(screen.getByText("Serviço B")).toBeInTheDocument();
    expect(screen.getByText("12x")).toBeInTheDocument();
    expect(screen.getByText("8x")).toBeInTheDocument();
  });

  it("exibe receita formatada por serviço", () => {
    render(<ReportsTopServices services={services} />);

    expect(screen.getByText("R$ 600,00 em receita")).toBeInTheDocument();
    expect(screen.getByText("R$ 280,00 em receita")).toBeInTheDocument();
  });

  it("renderiza empty state quando não há serviços", () => {
    render(<ReportsTopServices services={[]} />);

    expect(screen.getByText("Nenhuma venda no mês")).toBeInTheDocument();
  });
});
