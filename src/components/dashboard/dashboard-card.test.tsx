import { CalendarDaysIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { render } from "@/test/utils";

describe("DashboardCard", () => {
  it("renderiza título, descrição e filhos", () => {
    const { getByText } = render(
      <DashboardCard icon={CalendarDaysIcon} title="Agenda" description="Próximos atendimentos">
        <button type="button">Acessar</button>
      </DashboardCard>,
    );

    expect(getByText("Agenda")).toBeInTheDocument();
    expect(getByText("Próximos atendimentos")).toBeInTheDocument();
    expect(getByText("Acessar")).toBeInTheDocument();
  });
});
