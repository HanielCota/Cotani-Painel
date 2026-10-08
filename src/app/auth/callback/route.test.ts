import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  getUser: vi.fn(), getClaims: vi.fn(),
  mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth })) }));
vi.mock("@/lib/supabase/config", () => ({ getPublicSupabaseConfig: () => ({
  supabaseUrl: "https://project-ref.supabase.co", supabasePublishableKey: "test-key",
}) }));
const { GET, POST } = await import("@/app/auth/callback/route");
const origin = "https://painel.cotani.com.br";

function post(intent: "begin" | "password", fields: Record<string, string> = {}, cookie?: [string, string]) {
  const request = new NextRequest(`${origin}/auth/callback`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ intent, ...fields }),
  });
  if (cookie) request.cookies.set(...cookie);
  return request;
}
const password = { password: "senha-forte-123", confirmPassword: "senha-forte-123" };

describe("recuperação de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", amr: [{ method: "recovery" }] } }, error: null });
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  });

  it("não consome o token em GET", async () => {
    const response = await GET(new NextRequest(`${origin}/auth/callback?token_hash=hash&type=recovery`));
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${origin}/auth/confirm-recovery`);
    expect(response.cookies.get("cotani_recovery_token")?.value).toBe("hash");
  });

  it("valida explicitamente o link e exige MFA primeiro quando ativo", async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const response = await POST(post("begin", {}, ["cotani_recovery_token", "hash"]));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "recovery" });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${origin}/auth/recovery-mfa`);
    expect(response.cookies.get("cotani_recovery_pending")?.value).toBe("1");
  });

  it("dispensa MFA somente quando a conta não o usa", async () => {
    const response = await POST(post("begin", {}, ["cotani_recovery_token", "hash"]));
    expect(response.headers.get("location")).toBe(`${origin}/auth/confirm-recovery`);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("falha fechado quando não consegue consultar o MFA", async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: { code: "network" } });
    const response = await POST(post("begin", {}, ["cotani_recovery_token", "hash"]));
    expect(response.headers.get("location")).toBe(`${origin}/auth/confirm-recovery?error=mfa_unavailable`);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("não aceita senha antes de confirmar o autenticador", async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const response = await POST(post("password", password));
    expect(response.headers.get("location")).toBe(`${origin}/auth/recovery-mfa`);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("salva após AAL2 e encerra a sessão temporária", async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    const response = await POST(post("password", password, ["sb-project-ref-auth-token.3", "session-value"]));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: password.password });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(response.headers.get("location")).toBe(`${origin}/sign-in?password=updated`);
    expect(response.cookies.get("sb-project-ref-auth-token.3")?.value).toBe("");
  });

  it("senha fraca ou repetida não exige novo link", async () => {
    for (const code of ["weak_password", "same_password"]) {
      auth.updateUser.mockResolvedValueOnce({ error: { code } });
      const response = await POST(post("password", password));
      expect(response.headers.get("location")).toBe(`${origin}/auth/confirm-recovery?error=${code}`);
      expect(response.cookies.get("cotani_recovery_pending")?.value).toBe("1");
      expect(auth.signOut).not.toHaveBeenCalled();
    }
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("confirmação diferente não consome o link", async () => {
    const response = await POST(post("password", { ...password, confirmPassword: "outra" }));
    expect(response.headers.get("location")).toBe(`${origin}/auth/confirm-recovery?error=mismatch`);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("não aceita sessão comum nem sessão expirada", async () => {
    auth.getClaims.mockResolvedValueOnce({ data: { claims: { amr: [{ method: "password" }] } }, error: null });
    const common = await POST(post("password", password));
    expect(common.headers.get("location")).toBe(`${origin}/auth/confirm-recovery?error=invalid`);
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "session_not_found" } });
    const expired = await POST(post("password", password));
    expect(expired.headers.get("location")).toBe(`${origin}/auth/confirm-recovery?error=invalid`);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("link no formato code também entra no fluxo protegido, nunca direto no painel", async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const response = await GET(new NextRequest(`${origin}/auth/callback?code=valid&next=/update-password`));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe(`${origin}/auth/recovery-mfa`);
    expect(response.cookies.get("cotani_recovery_pending")?.value).toBe("1");
  });

  it("link de recuperação vencido explica o motivo na tela de recuperação", async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { code: "flow_state_not_found" } });
    const response = await GET(new NextRequest(`${origin}/auth/callback?code=old&next=/auth/confirm-recovery`));
    expect(response.headers.get("location")).toBe(`${origin}/forgot-password?error=link`);
  });

  it("sessão comum (convite/login) segue para o destino pedido", async () => {
    auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1", amr: [{ method: "otp" }] } }, error: null });
    const response = await GET(new NextRequest(`${origin}/auth/callback?code=valid&next=/dashboard/agenda`));
    expect(response.headers.get("location")).toBe(`${origin}/dashboard/agenda`);
  });

  it("não redireciona para domínio externo", async () => {
    auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1", amr: [{ method: "oauth" }] } }, error: null });
    const response = await GET(new NextRequest(`${origin}/auth/callback?code=valid&next=${encodeURIComponent("//evil.example")}`));
    expect(response.headers.get("location")).toBe(`${origin}/dashboard`);
  });
});
