import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CancelAppointmentError } from "@/components/public/cancel-appointment-error";
import { render } from "@/test/utils";

describe("CancelAppointmentError", () => {
  it("renderiza mensagem amigável para agendamento expirado", () => {
    render(<CancelAppointmentError clinicName="Barbearia Teste" clinicSlug="barbearia-teste" variant="expired" />);

    expect(screen.getByText("Este agendamento já expirou")).toBeInTheDocument();
    expect(
      screen.getByText(/horário do atendimento em Barbearia Teste já passou/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fazer novo agendamento/i })).toHaveAttribute(
      "href",
      "/barbearia-teste"
    );
  });

  it("renderiza mensagem amigável para agendamento já cancelado", () => {
    render(
      <CancelAppointmentError clinicName="Barbearia Teste" clinicSlug="barbearia-teste" variant="already-canceled" />
    );

    expect(screen.getByText("Este agendamento já foi cancelado")).toBeInTheDocument();
    expect(
      screen.getByText(/agendamento em Barbearia Teste já foi cancelado anteriormente/i)
    ).toBeInTheDocument();
  });
});
