import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { render } from "@/test/utils";

const routerPush = vi.hoisted(() => vi.fn());
const resetPasswordForEmail = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const getClaims = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      getClaims,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resetPasswordForEmail,
      updateUser,
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
    updateUser.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "otp" }] } }, error: null });
  });

  it("confirma visualmente o envio das instruções de recuperação", async () => {
    render(<PasswordRecoveryForm mode="request" />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cotani.com.br" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar link de redefinição" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("teste@cotani.com.br");
    expect(screen.getByRole("button", { name: "Enviar novamente" })).toBeInTheDocument();
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "teste@cotani.com.br",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback?next=/auth/confirm-recovery") }),
    );
  });

  it("permite voltar ao formulário para reenviar", async () => {
    render(<PasswordRecoveryForm mode="request" />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cotani.com.br" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar link de redefinição" }).closest("form")!);
    await screen.findByRole("heading", { name: "Verifique seu e-mail" });

    fireEvent.click(screen.getByRole("button", { name: "Enviar novamente" }));

    await waitFor(() => expect(screen.getByLabelText("E-mail")).toBeInTheDocument());
  });

  it("envia apenas uma solicitação mesmo com submissões repetidas", async () => {
    let resolveRequest!: (value: { error: null }) => void;
    resetPasswordForEmail.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<PasswordRecoveryForm mode="request" />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "teste@cotani.com.br" } });
    const form = screen.getByRole("button", { name: "Enviar link de redefinição" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    resolveRequest({ error: null });
    expect(await screen.findByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
  });

  it("explica quando a política do Supabase rejeita a nova senha", async () => {
    updateUser.mockResolvedValue({
      error: { code: "weak_password", message: "Password should be at least 8 characters." },
    });
    render(<PasswordRecoveryForm mode="update" />);

    const password = await screen.findByLabelText("Nova senha");
    const confirmation = screen.getByLabelText("Confirme a senha");
    await waitFor(() => expect(password).toBeEnabled());
    fireEvent.change(password, { target: { value: "senha123" } });
    fireEvent.change(confirmation, { target: { value: "senha123" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar senha" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Use uma senha com pelo menos 8 caracteres.");
  });
});

describe("PasswordRecoveryForm - destino do link", () => {
  it("o e-mail de recuperação aponta para o fluxo protegido, não para a tela de convite", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<PasswordRecoveryForm mode="request" />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar link de redefinição" }).closest("form")!);
    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalled());
    expect(resetPasswordForEmail.mock.calls[0][1].redirectTo).toMatch(/\/auth\/callback\?next=\/auth\/confirm-recovery$/);
  });
});
