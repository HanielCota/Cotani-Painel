import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect: vi.fn() },
}));

const { auth } = await import("@clerk/nextjs/server");
const { getPlatformAdminContext, PlatformAdminAccessError, requirePlatformAdmin } = await import("@/server/platform-admin");

describe("platform admin access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PLATFORM_ADMIN_CLERK_USER_IDS;
  });

  it("permite somente um Clerk user ID da allowlist", async () => {
    process.env.PLATFORM_ADMIN_CLERK_USER_IDS = "user_owner, user_backup";
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user_owner" });

    await expect(getPlatformAdminContext()).resolves.toEqual({ userId: "user_owner" });
  });

  it("nega usuário autenticado fora da allowlist", async () => {
    process.env.PLATFORM_ADMIN_CLERK_USER_IDS = "user_owner";
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user_other" });

    await expect(getPlatformAdminContext()).resolves.toBeNull();
  });

  it("falha fechado quando a configuração está ausente", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user_owner" });

    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(PlatformAdminAccessError);
  });
});
