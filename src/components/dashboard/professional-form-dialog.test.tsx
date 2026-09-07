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
      { id: "svc-1", name: "Serviço A", duration: 30, isActive: true },
      { id: "svc-2", name: "Serviço B", duration: 20, isActive: true },
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
    const createProfessionalMock = createProfessionalFromForm as ReturnType<typeof vi.fn>;
    createProfessionalMock.mockResolvedValueOnce({
      status: "success",
      message: "Profissional cadastrado.",
    });

    render(<ProfessionalFormDialog />);

    fireEvent.click(screen.getByRole("button", { name: /novo profissional/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /novo profissional/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Carlos" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /serviço a/i }));

    fireEvent.click(screen.getByRole("button", { name: /cadastrar profissional/i }));

    await waitFor(() => {
      expect(createProfessionalMock).toHaveBeenCalledTimes(1);
    });

    const submittedFormData = createProfessionalMock.mock.calls[0][1] as FormData;
    expect(submittedFormData.getAll("serviceIds")).toEqual(["svc-1"]);
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

    fireEvent.click(screen.getByRole("button", { name: "Editar profissional Ana" }));

    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /serviço b/i })).toBeChecked();
  });


});
