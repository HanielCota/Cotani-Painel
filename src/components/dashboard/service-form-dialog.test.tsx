import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceFormDialog } from "@/components/dashboard/service-form-dialog";
import { render } from "@/test/utils";
import type { ServiceListItem } from "@/types";

vi.mock("@/server/actions/services", () => ({
  createServiceFromForm: vi.fn(),
  updateServiceFromForm: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { createServiceFromForm } = await import("@/server/actions/services");

describe("ServiceFormDialog", () => {
  it("abre diálogo e cadastra novo serviço", async () => {
    (createServiceFromForm as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Serviço cadastrado.",
    });

    render(<ServiceFormDialog />);

    fireEvent.click(screen.getByRole("button", { name: /novo serviço/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /novo serviço/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /selecionar imagem/i })).toBeInTheDocument();
    expect(screen.getByText(/nenhum arquivo selecionado/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Serviço A" } });
    fireEvent.change(screen.getByLabelText(/duração/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/valor/i), { target: { value: "50" } });

    fireEvent.click(screen.getByRole("button", { name: /cadastrar serviço/i }));

    await waitFor(() => {
      expect(createServiceFromForm).toHaveBeenCalled();
    });
  });

  it("preenche dados ao editar serviço", () => {
    const service: ServiceListItem = {
      id: "svc-1",
      name: "Serviço B",
      duration: 20,
      price: 35,
      imageUrl: null,
      isActive: true,
    };

    render(<ServiceFormDialog service={service} />);

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByDisplayValue("Serviço B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("35")).toBeInTheDocument();
  });

  it("converte imagem selecionada para base64 e envia no formData", async () => {
    const file = new File(["dummy"], "service.jpg", { type: "image/jpeg" });

    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.result = "data:image/jpeg;base64,dummy";
        setTimeout(() => {
          this.onload?.({ target: { result: this.result } } as ProgressEvent<FileReader>);
        }, 0);
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    (createServiceFromForm as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      message: "Serviço cadastrado.",
    });

    render(<ServiceFormDialog />);

    fireEvent.click(screen.getByRole("button", { name: /novo serviço/i }));

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Serviço A" } });
    fireEvent.change(screen.getByLabelText(/duração/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/valor/i), { target: { value: "50" } });

    const fileInput = screen.getByLabelText(/imagem/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/preview do serviço/i)).toHaveAttribute("src", "data:image/jpeg;base64,dummy");
    });
    expect(screen.getByText("service.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trocar imagem/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cadastrar serviço/i }));

    await waitFor(() => {
      expect(createServiceFromForm).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });
});
