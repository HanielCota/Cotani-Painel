import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { render } from "@/test/utils";

vi.mock("@/server/actions/appointments", () => ({
  updateAppointmentStatus: vi.fn(),
}));

const { updateAppointmentStatus } = await import("@/server/actions/appointments");

describe("AppointmentActions", () => {
  it("renderiza menu de ações para agendamento PENDING", () => {
    render(<AppointmentActions appointmentId="app-1" status="PENDING" />);

    expect(screen.getByRole("button", { name: /ações/i })).toBeInTheDocument();
  });

  it("renderiza ações de confirmar, cancelar e não compareceu para PENDING", () => {
    render(<AppointmentActions appointmentId="app-1" status="PENDING" />);

    fireEvent.click(screen.getByRole("button", { name: /ações/i }));

    expect(screen.getByRole("menuitem", { name: /confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /não compareceu/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /concluir/i })).not.toBeInTheDocument();
  });

  it("renderiza ação de concluir para agendamento CONFIRMED", () => {
    render(<AppointmentActions appointmentId="app-1" status="CONFIRMED" />);

    fireEvent.click(screen.getByRole("button", { name: /ações/i }));

    expect(screen.getByRole("menuitem", { name: /concluir/i })).toBeInTheDocument();
  });

  it("abre diálogo de método de pagamento ao clicar em concluir", () => {
    render(<AppointmentActions appointmentId="app-1" status="CONFIRMED" />);

    fireEvent.click(screen.getByRole("button", { name: /ações/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /concluir/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Concluir atendimento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar pagamento/i })).toBeInTheDocument();
  });

  it("usa diálogo personalizado antes de marcar uma falta", async () => {
    (updateAppointmentStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Atualizado",
    });
    render(<AppointmentActions appointmentId="app-1" status="CONFIRMED" />);

    fireEvent.click(screen.getByRole("button", { name: /ações/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /não compareceu/i }));

    expect(screen.getByRole("dialog", { name: "Marcar como falta?" })).toBeInTheDocument();
    expect(screen.getByText(/histórico do cliente/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como falta" }));

    await waitFor(() => {
      expect(updateAppointmentStatus).toHaveBeenCalledWith("app-1", { status: "NO_SHOW" });
    });
  });

  it("envia status COMPLETED com método de pagamento selecionado", async () => {
    (updateAppointmentStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Atualizado",
    });

    render(<AppointmentActions appointmentId="app-1" status="CONFIRMED" />);

    fireEvent.click(screen.getByRole("button", { name: /ações/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /concluir/i }));

    // Seleciona Pix no Select
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /pix/i }));

    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));

    await waitFor(() => {
      expect(updateAppointmentStatus).toHaveBeenCalledWith("app-1", {
        status: "COMPLETED",
        paymentMethod: "PIX",
      });
    });
  });

  it("não renderiza nada para agendamentos finalizados", () => {
    const { container } = render(<AppointmentActions appointmentId="app-1" status="COMPLETED" />);

    expect(container.firstChild).toBeNull();
  });
});
