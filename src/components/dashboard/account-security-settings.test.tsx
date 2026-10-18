import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSecuritySettings } from "@/components/dashboard/account-security-settings";
import { render } from "@/test/utils";

const getUser = vi.hoisted(() => vi.fn());
const listFactors = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const verificationSignOut = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser,
      mfa: {
        listFactors,
        enroll: vi.fn(),
        unenroll: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
      signOut: vi.fn(),
      updateUser,
    },
  }),
  createPasswordVerificationClient: () => ({
    auth: {
      signInWithPassword,
      signOut: verificationSignOut,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

vi.mock("@/components/security/turnstile-widget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange(token: string | null): void }) => (
    <button type="button" onClick={() => onTokenChange("captcha-test-token")}>Concluir verificação de segurança</button>
  ),
}));

describe("AccountSecuritySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { email: "pessoa@cotani.com.br" } }, error: null });
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    verificationSignOut.mockResolvedValue({ error: null });
  });

  function fillPasswordFields() {
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "SenhaAtual123!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "NovaSenha456!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "NovaSenha456!" } });
  }

  function completeCaptcha() {
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação de segurança" }));
  }

  it("não altera a senha quando a senha atual estiver incorreta", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
    render(<AccountSecuritySettings />);
    await waitFor(() => expect(listFactors).toHaveBeenCalled());
    fillPasswordFields();
    completeCaptcha();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("revalida a identidade antes de atualizar a senha", async () => {
    render(<AccountSecuritySettings />);
    await waitFor(() => expect(listFactors).toHaveBeenCalled());
    fillPasswordFields();
    completeCaptcha();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({
      password: "NovaSenha456!",
      current_password: "SenhaAtual123!",
    }));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "pessoa@cotani.com.br",
      password: "SenhaAtual123!",
      options: { captchaToken: "captcha-test-token" },
    });
    expect(verificationSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(toastSuccess).toHaveBeenCalledWith("Senha atualizada com segurança.");
  });
});
