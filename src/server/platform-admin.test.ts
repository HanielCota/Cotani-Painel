import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireAuthenticatedUser: vi.fn(),
}));

const { AuthenticationRequiredError, requireAuthenticatedUser } = await import("@/server/auth");
const { getPlatformAdminContext, PlatformAdminAccessError, requirePlatformAdmin } = await import("@/server/platform-admin");

describe("platform admin access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PLATFORM_ADMIN_USER_IDS;
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
