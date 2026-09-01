import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceDateTabs } from "@/components/dashboard/finance-date-tabs";
import { render } from "@/test/utils";

describe("FinanceDateTabs", () => {
  it("gera filtros navegáveis e identifica o período atual", () => {
    render(<FinanceDateTabs activePeriod="30days" />);

    expect(screen.getByRole("link", { name: "Hoje" })).toHaveAttribute("href", "/dashboard/financeiro?period=today");
    expect(screen.getByRole("link", { name: "Últimos 7 dias" })).toHaveAttribute("href", "/dashboard/financeiro?period=7days");
    expect(screen.getByRole("link", { name: "Últimos 30 dias" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Este ano" })).toHaveAttribute("href", "/dashboard/financeiro?period=year");
  });
});
