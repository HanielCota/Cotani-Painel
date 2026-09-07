import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubscriptionCheckout, type SubscriptionPlanData } from "@/components/dashboard/subscription-checkout";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { render } from "@/test/utils";

const plans: SubscriptionPlanData[] = [
  {
    id: SubscriptionPlan.ESSENTIAL,
    name: "Essencial",
    description: "Para profissionais autônomos",
    monthlyPrice: 34.9,
    annualPrice: 335.04,
    features: ["1 profissional"],
    selfServiceCheckout: true,
    configuredCycles: [BillingCycle.MONTHLY, BillingCycle.ANNUAL],
  },
  {
    id: SubscriptionPlan.ENTERPRISE,
    name: "Empresa",
    description: "Para múltiplas unidades",
    monthlyPrice: 97.9,
    annualPrice: 939.84,
    features: ["Profissionais ilimitados"],
    selfServiceCheckout: false,
    configuredCycles: [],
  },
];

describe("SubscriptionCheckout", () => {
  it("renderiza planos e alterna o ciclo", async () => {
    render(<SubscriptionCheckout plans={plans} />);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*34,90/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /anual/i }));
    expect(screen.getByText(/R\$\s*335,04/)).toBeInTheDocument();
  });

  it("exibe contratação comercial para o plano Empresa", () => {
    render(<SubscriptionCheckout plans={plans} />);
    expect(screen.getByRole("button", { name: /falar sobre o plano empresa/i })).toBeInTheDocument();
  });

  it("envia plano e ciclo ao checkout", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ checkoutUrl: "https://mp.test/checkout" }), { status: 200 }),
    );
    render(<SubscriptionCheckout plans={plans} />);
    await userEvent.click(screen.getByRole("button", { name: /assinar essencial/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/subscription/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plan: SubscriptionPlan.ESSENTIAL, cycle: BillingCycle.MONTHLY }),
      }),
    );
    fetchSpy.mockRestore();
  });
});
