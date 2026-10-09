import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { render } from "@/test/utils";

function row(label: string) {
  return screen.getByText(label).closest("tr") as HTMLElement;
}

describe("PlanComparisonTable", () => {
  it("deriva as linhas das permissões de cada plano", () => {
    render(<PlanComparisonTable currentPlan="PROFESSIONAL" />);

    expect(within(row("Profissionais")).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Profissionais", "1", "Até 3", "Ilimitados"]);
    expect(within(row("Financeiro")).getByLabelText("Não incluído")).toBeInTheDocument();
    expect(within(row("Financeiro")).getAllByLabelText("Incluído")).toHaveLength(2);
    expect(within(row("Múltiplas unidades")).getAllByLabelText("Incluído")).toHaveLength(1);
  });

  it("marca o plano atual", () => {
    render(<PlanComparisonTable currentPlan="ESSENTIAL" />);
    const header = screen.getByText("Seu plano").closest("th") as HTMLElement;
    expect(header).toHaveTextContent("Essencial");
  });
});
