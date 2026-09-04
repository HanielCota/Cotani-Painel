import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaymentRequiredState } from "@/components/dashboard/payment-required-state";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { render } from "@/test/utils";

vi.mock("@/components/dashboard/subscription-checkout", () => ({
  SubscriptionCheckout: () => <div>Opções de planos carregadas</div>,
}));

const plans = [{
  id: SubscriptionPlan.ESSENTIAL,
  name: "Essencial",
  description: "Plano de teste",
  monthlyPrice: 34.9,
  annualPrice: 335.04,
  features: ["Agenda"],
  selfServiceCheckout: true,
  configuredCycles: [BillingCycle.MONTHLY],
}];

describe("PaymentRequiredState", () => {
  it("abre as opções de assinatura para administradores", async () => {
    render(<PaymentRequiredState clinicName="Empresa Teste" plans={plans} />);

    fireEvent.click(screen.getByRole("button", { name: /ver opções de assinatura/i }));

    expect(await screen.findByText("Escolha o plano da sua empresa")).toBeInTheDocument();
    expect(screen.getByText("Opções de planos carregadas")).toBeInTheDocument();
  });

  it("orienta outros perfis a procurar um administrador", () => {
    render(<PaymentRequiredState clinicName="Empresa Teste" />);

    expect(screen.queryByRole("button", { name: /ver opções de assinatura/i })).not.toBeInTheDocument();
    expect(screen.getByText(/peça a um administrador/i)).toBeInTheDocument();
  });
});
