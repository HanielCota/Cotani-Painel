import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireAuthenticatedUser: vi.fn(),
}));
const listFactors = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { mfa: { listFactors, getAuthenticatorAssuranceLevel } },
  })),
}));

const { AuthenticationRequiredError, requireAuthenticatedUser } = await import("@/server/auth");
const { getPlatformAdminAccess, getPlatformAdminContext, PlatformAdminAccessError, requirePlatformAdmin } = await import("@/server/platform-admin");

describe("platform admin access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PLATFORM_ADMIN_USER_IDS;
    listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1", status: "verified" }] }, error: null });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
  });

  it("exige que o administrador global cadastre MFA", async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = "user_owner";
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "user_owner" });
    listFactors.mockResolvedValueOnce({ data: { totp: [] }, error: null });

    await expect(getPlatformAdminAccess()).resolves.toEqual({ status: "mfa-enrollment-required" });
  });

  it("exige desafio AAL2 quando o fator já está cadastrado", async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = "user_owner";
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "user_owner" });
    getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });

    await expect(getPlatformAdminAccess()).resolves.toEqual({ status: "mfa-challenge-required" });
  });

  it("permite somente um Supabase user ID da allowlist", async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = "user_owner, user_backup";
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "user_owner" });

    await expect(getPlatformAdminContext()).resolves.toEqual({ userId: "user_owner" });
  });

  it("nega usuário autenticado fora da allowlist", async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = "user_owner";
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "user_other" });

    await expect(getPlatformAdminContext()).resolves.toBeNull();
  });

  it("nega uma requisição sem sessão sem gerar erro interno", async () => {
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new AuthenticationRequiredError());

    await expect(getPlatformAdminContext()).resolves.toBeNull();
  });

  it("falha fechado quando a configuração está ausente", async () => {
    (requireAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "user_owner" });

    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(PlatformAdminAccessError);
  });
});
