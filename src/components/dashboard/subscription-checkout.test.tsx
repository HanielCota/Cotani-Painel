import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
import { render } from "@/test/utils";

const plans = [
  { id: "MONTHLY" as const, name: "Mensal", price: 29.9, description: "Renovação automática todo mês" },
  { id: "ANNUAL" as const, name: "Anual", price: 299.9, description: "2 meses grátis no ano" },
];

describe("SubscriptionCheckout", () => {
  it("renderiza os planos disponíveis", () => {
    render(<SubscriptionCheckout plans={plans} />);

    expect(screen.getByText("Mensal")).toBeInTheDocument();
    expect(screen.getByText("Anual")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*29,90/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*299,90/)).toBeInTheDocument();
  });

  it("exibe mensagem de configuração quando não há planos", () => {
    render(<SubscriptionCheckout plans={[]} />);

    expect(screen.getByText(/checkout automático ainda não está configurado/i)).toBeInTheDocument();
  });

  it("dispara fetch ao clicar em assinar", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ checkoutUrl: "https://mp.test/checkout" }), { status: 200 }),
    );

    render(<SubscriptionCheckout plans={plans} />);

    await userEvent.click(screen.getByRole("button", { name: /assinar mensal/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/subscription/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plan: "MONTHLY" }),
      }),
    );

    fetchSpy.mockRestore();
  });
});
