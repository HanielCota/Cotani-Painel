import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { render } from "@/test/utils";

describe("CopyBookingLink", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("copiar o link também conclui o passo de divulgação do checklist", async () => {
    render(<CopyBookingLink url="https://painel.cotani.com.br/loja" />);
    fireEvent.click(screen.getByRole("button", { name: /copiar link de agendamento/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());

    // Falta só o primeiro agendamento: com o link contado como divulgado, são 5 de 6.
    render(
      <OnboardingChecklist
        bookingUrl="https://painel.cotani.com.br/loja"
        hasServices={true}
        hasBusinessHours={true}
        hasProfessionals={true}
        hasAppointments={false}
        isSubscriptionActive={true}
      />,
    );

    expect(screen.getByTestId("onboarding-progress")).toHaveTextContent(/^5\s*de 6 concluídos/);
  });
});
