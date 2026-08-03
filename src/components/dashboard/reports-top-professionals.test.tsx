import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportsTopProfessionals } from "@/components/dashboard/reports-top-professionals";
import { render } from "@/test/utils";

const professionals = [
  { name: "Carlos", count: 15 },
  { name: "Ana", count: 9 },
];

describe("ReportsTopProfessionals", () => {
  it("renderiza título e lista de profissionais", () => {
    render(<ReportsTopProfessionals professionals={professionals} />);

    expect(screen.getByText("Profissionais em destaque")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("15 atend.")).toBeInTheDocument();
    expect(screen.getByText("9 atend.")).toBeInTheDocument();
  });

  it("renderiza empty state quando não há atendimentos", () => {
    render(<ReportsTopProfessionals professionals={[]} />);

    expect(screen.getByText("Nenhum atendimento no mês")).toBeInTheDocument();
  });
});
