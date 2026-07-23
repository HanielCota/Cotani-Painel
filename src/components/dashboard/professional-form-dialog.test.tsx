import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfessionalFormDialog } from "@/components/dashboard/professional-form-dialog";
import { render } from "@/test/utils";
import type { ProfessionalListItem } from "@/types";

vi.mock("@/server/actions/professionals", () => ({
  createProfessionalFromForm: vi.fn(),
  updateProfessionalFromForm: vi.fn(),
}));

vi.mock("@/hooks/use-services", () => ({
  useServices: () => ({
    data: [
      { id: "svc-1", name: "Corte", duration: 30, isActive: true },
      { id: "svc-2", name: "Barba", duration: 20, isActive: true },
    ],
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { createProfessionalFromForm } = await import("@/server/actions/professionals");

describe("ProfessionalFormDialog", () => {
  it("abre diálogo e cadastra novo profissional", async () => {
    (createProfessionalFromForm as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Profissional cadastrado.",
    });

    render(<ProfessionalFormDialog />);

    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /novo profissional/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Carlos" } });
    fireEvent.click(screen.getByLabelText(/corte/i));

    fireEvent.click(screen.getByRole("button", { name: /cadastrar profissional/i }));

    await waitFor(() => {
      expect(createProfessionalFromForm).toHaveBeenCalled();
    });
  });

  it("preenche dados ao editar profissional", () => {
    const professional: ProfessionalListItem = {
      id: "prof-1",
      name: "Ana",
      imageUrl: null,
      isActive: true,
      serviceIds: ["svc-2"],
    };

    render(<ProfessionalFormDialog professional={professional} />);

    fireEvent.click(screen.getByRole("button", { name: "" }));

    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByLabelText(/barba/i)).toBeChecked();
  });


});
