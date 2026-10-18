import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { render } from "@/test/utils";

function tableRow(label: string) {
  return within(screen.getByRole("table")).getByText(label).closest("tr") as HTMLElement;
}

function planCard(name: string) {
  const cards = within(screen.getByRole("list", { name: "Planos" })).getAllByRole("listitem");
  return cards.find((card) => within(card).queryByText(name)) as HTMLElement;
}

describe("PlanComparisonTable", () => {
  it("deriva as linhas das permissões de cada plano", () => {
    render(<PlanComparisonTable currentPlan="PROFESSIONAL" />);

    expect(within(tableRow("Profissionais")).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Profissionais", "1", "Até 3", "Ilimitados"]);
    expect(within(tableRow("Financeiro")).getByLabelText("Não incluído")).toBeInTheDocument();
    expect(within(tableRow("Financeiro")).getAllByLabelText("Incluído")).toHaveLength(2);
    expect(within(tableRow("Múltiplas unidades")).getAllByLabelText("Incluído")).toHaveLength(1);
  });

  it("marca o plano atual", () => {
    render(<PlanComparisonTable currentPlan="ESSENTIAL" />);

    const header = within(screen.getByRole("table")).getByText("Seu plano").closest("th") as HTMLElement;
    expect(header).toHaveTextContent("Essencial");
    expect(within(planCard("Essencial")).getByText("Seu plano")).toBeInTheDocument();
  });

  it("no celular mostra um cartão por plano com todos os recursos", () => {
    render(<PlanComparisonTable currentPlan="PROFESSIONAL" />);

    expect(within(screen.getByRole("list", { name: "Planos" })).getAllByRole("listitem")).toHaveLength(3);
    const professional = planCard("Profissional");
    expect(within(professional).getByText("Até 3")).toBeInTheDocument();
    const unitsRow = within(professional).getByText("Múltiplas unidades").closest("div") as HTMLElement;
    expect(within(unitsRow).getByLabelText("Não incluído")).toBeInTheDocument();
  });

  it("mostra Fale com a equipe no Empresa em vez de preço", () => {
    render(<PlanComparisonTable currentPlan="PROFESSIONAL" />);

    expect(within(planCard("Empresa")).getByText("Fale com a equipe")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Fale com a equipe")).toBeInTheDocument();
    expect(screen.queryByText(/97,90/)).not.toBeInTheDocument();
  });
});
