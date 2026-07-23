import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { render } from "@/test/utils";

const storage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  writable: true,
});

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

describe("OnboardingChecklist", () => {
  it("renderiza todos os passos", () => {
    render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/barbearia-teste"
        hasServices={false}
        hasBusinessHours={false}
        isSubscriptionActive={false}
      />
    );

    expect(screen.getByText("Assinatura ativa")).toBeInTheDocument();
    expect(screen.getByText("Definir expediente")).toBeInTheDocument();
    expect(screen.getByText("Cadastrar serviços")).toBeInTheDocument();
    expect(screen.getByText("Divulgar link de agendamento")).toBeInTheDocument();
  });

  it("marca passos concluídos com base nas props", () => {
    storage.set("cotani:onboarding:link-shared", "true");

    render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/barbearia-teste"
        hasServices={true}
        hasBusinessHours={true}
        isSubscriptionActive={true}
      />
    );

    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent("4de 4 concluídos");
  });

  it("persiste no localStorage ao copiar o link de agendamento", async () => {
    const { rerender } = render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/barbearia-teste"
        hasServices={true}
        hasBusinessHours={true}
        isSubscriptionActive={true}
      />
    );

    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent("3de 4 concluídos");

    const button = screen.getByRole("button", { name: /copiar link/i });
    fireEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://localhost:3000/barbearia-teste");
    expect(storage.get("cotani:onboarding:link-shared")).toBe("true");

    // Re-renderiza para validar que o estado foi lido do localStorage.
    rerender(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/barbearia-teste"
        hasServices={true}
        hasBusinessHours={true}
        isSubscriptionActive={true}
      />
    );

    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent("4de 4 concluídos");
  });
});
