import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import { requestNewAppointment } from "@/lib/shortcuts";
import { render } from "@/test/utils";

vi.mock("@/server/actions/appointments", () => ({ createAppointmentFromForm: vi.fn() }));

const props = {
  customers: [{ id: "c1", name: "Ana" }],
  services: [{ id: "s1", name: "Corte", duration: 30 }],
  minStartTime: "2026-10-08T10:00",
  timeZone: "America/Sao_Paulo",
};

describe("AppointmentFormDialog e o atalho N", () => {
  it("abre quando o atalho pede um novo atendimento", async () => {
    render(<AppointmentFormDialog {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    let handled = false;
    act(() => {
      handled = requestNewAppointment();
    });

    expect(handled).toBe(true);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("abre ao carregar com defaultOpen (vindo de ?novo=1)", async () => {
    render(<AppointmentFormDialog {...props} defaultOpen />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("diálogo controlado (clique na grade) ignora o atalho", () => {
    render(<AppointmentFormDialog {...props} open={false} onOpenChange={vi.fn()} />);
    let handled = true;
    act(() => {
      handled = requestNewAppointment();
    });
    expect(handled).toBe(false);
  });
});
