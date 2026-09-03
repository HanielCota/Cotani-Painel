import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { render } from "@/test/utils";

const routerPush = vi.hoisted(() => vi.fn());
const resetPasswordForEmail = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail,
      updateUser: vi.fn(),
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("PasswordRecoveryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("confirma visualmente o envio das instruções de recuperação", async () => {
    render(<PasswordRecoveryForm mode="request" />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cotani.com.br" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar e-mail de recuperação" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("teste@cotani.com.br");
    expect(screen.getByRole("button", { name: "Enviar novamente" })).toBeInTheDocument();
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "teste@cotani.com.br",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback?next=/update-password") }),
    );
  });

  it("permite voltar ao formulário para reenviar", async () => {
    render(<PasswordRecoveryForm mode="request" />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cotani.com.br" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar e-mail de recuperação" }).closest("form")!);
    await screen.findByRole("heading", { name: "Verifique seu e-mail" });

    fireEvent.click(screen.getByRole("button", { name: "Enviar novamente" }));

    await waitFor(() => expect(screen.getByLabelText("E-mail")).toBeInTheDocument());
  });
});
