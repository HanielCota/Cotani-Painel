import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        bookingUrl="https://localhost:3000/loja-teste"
        hasServices={false}
        hasBusinessHours={false}
        hasProfessionals={false}
        hasAppointments={false}
        isSubscriptionActive={false}
      />
    );

    expect(screen.getByText("Assinatura ativa")).toBeInTheDocument();
    expect(screen.getByText("Definir expediente")).toBeInTheDocument();
    expect(screen.getByText("Cadastrar serviços")).toBeInTheDocument();
    expect(screen.getByText("Cadastrar profissionais")).toBeInTheDocument();
    expect(screen.getByText("Divulgar link de agendamento")).toBeInTheDocument();
    expect(screen.getByText("Receber o primeiro agendamento")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Configurar" })[0]).toHaveAttribute("href", "/dashboard/assinatura");
  });

  it("leva cada revisão diretamente à configuração correta", () => {
    render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/loja-teste"
        hasServices
        hasBusinessHours
        hasProfessionals={false}
        hasAppointments={false}
        isSubscriptionActive={false}
      />
    );

    const reviewLinks = screen.getAllByRole("link", { name: "Revisar" });
    expect(reviewLinks[0]).toHaveAttribute("href", "/dashboard/negocio/horarios");
    expect(reviewLinks[1]).toHaveAttribute("href", "/dashboard/negocio/servicos");
  });

  it("oculta o checklist quando todos os passos estão concluídos", async () => {
    storage.set("cotani:onboarding:link-shared", "true");

    render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/loja-teste"
        hasServices={true}
        hasBusinessHours={true}
        hasProfessionals={true}
        hasAppointments={true}
        isSubscriptionActive={true}
      />
    );

    await waitFor(() => expect(screen.queryByTestId("onboarding-progress")).not.toBeInTheDocument());
  });

  it("persiste no localStorage ao copiar o link de agendamento", async () => {
    const { rerender } = render(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/loja-teste"
        hasServices={true}
        hasBusinessHours={true}
        hasProfessionals={true}
        hasAppointments={false}
        isSubscriptionActive={true}
      />
    );

    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent("4de 6 concluídos");

    const button = screen.getByRole("button", { name: /copiar link/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://localhost:3000/loja-teste");
      expect(storage.get("cotani:onboarding:link-shared")).toBe("true");
    });

    // Re-renderiza para validar que o estado foi lido do localStorage.
    rerender(
      <OnboardingChecklist
        bookingUrl="https://localhost:3000/loja-teste"
        hasServices={true}
        hasBusinessHours={true}
        hasProfessionals={true}
        hasAppointments={false}
        isSubscriptionActive={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-progress")).toHaveTextContent("5de 6 concluídos");
    });
  });
});
