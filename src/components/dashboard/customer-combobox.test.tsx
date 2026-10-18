import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CustomerCombobox } from "@/components/dashboard/customer-combobox";

const customers = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Ana Souza" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Helena Martins" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Rafael Cunha" },
];

describe("seletor pesquisável de clientes", () => {
  it("filtra pelo nome e envia o identificador do cliente selecionado", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <label htmlFor="customerId">Cliente</label>
        <CustomerCombobox customers={customers} />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: "Cliente" });
    await user.click(input);
    await user.type(input, "Helena");

    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Helena Martins" }));

    expect(input).toHaveValue("Helena Martins");
    const form = container.querySelector("form");
    if (!form) throw new Error("formulário não encontrado");
    expect(new FormData(form).get("customerId")).toBe(customers[1].id);
  });

  it("preserva o cliente inicial pelo identificador", () => {
    render(
      <form>
        <label htmlFor="customerId">Cliente</label>
        <CustomerCombobox customers={customers} defaultCustomerId={customers[2].id} />
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Cliente" })).toHaveValue("Rafael Cunha");
  });

  it("aceita um identificador próprio quando há vários formulários na página", () => {
    render(
      <form>
        <label htmlFor="edit-customer">Cliente do atendimento</label>
        <CustomerCombobox customers={customers} id="edit-customer" />
      </form>,
    );

    expect(screen.getByRole("combobox", { name: "Cliente do atendimento" })).toHaveAttribute("id", "edit-customer");
  });
});
