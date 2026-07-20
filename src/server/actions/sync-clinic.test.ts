import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncActiveClinic } from "@/server/actions/sync-clinic";

vi.mock("@clerk/nextjs/server", () => {
  const protect = vi.fn();
  return {
    auth: Object.assign(vi.fn(() => ({ protect })), { protect }),
    clerkClient: vi.fn(),
  };
});

vi.mock("@/server/services/clinic-provisioning", () => ({
  provisionMembership: vi.fn(),
}));

const { auth } = await import("@clerk/nextjs/server");
const { clerkClient } = await import("@clerk/nextjs/server");
const { provisionMembership } = await import("@/server/services/clinic-provisioning");

describe("syncActiveClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna erro quando não há organização", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: null, userId: "user-1" });

    const result = await syncActiveClinic();

    expect(result.status).toBe("error");
    expect(result.message).toContain("Nenhuma barbearia");
  });

  it("retorna erro quando falha ao buscar organização no Clerk", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1", userId: "user-1" });
    (clerkClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      organizations: {
        getOrganization: vi.fn().mockRejectedValueOnce(new Error("fail")),
      },
    });

    const result = await syncActiveClinic();

    expect(result.status).toBe("error");
  });

  it("retorna erro quando falha ao buscar usuário no Clerk", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1", userId: "user-1" });
    (clerkClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      organizations: {
        getOrganization: vi.fn().mockResolvedValueOnce({ id: "org-1", name: "Barbearia" }),
      },
      users: {
        getUser: vi.fn().mockRejectedValueOnce(new Error("fail")),
      },
    });

    const result = await syncActiveClinic();

    expect(result.status).toBe("error");
  });

  it("sincroniza com sucesso", async () => {
    (auth.protect as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ orgId: "org-1", userId: "user-1" });
    (clerkClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      organizations: {
        getOrganization: vi.fn().mockResolvedValueOnce({
          id: "org-1",
          name: "Barbearia",
          publicMetadata: { plan: "MONTHLY" },
        }),
      },
      users: {
        getUser: vi.fn().mockResolvedValueOnce({
          id: "user-1",
          emailAddresses: [{ emailAddress: "owner@example.com" }],
          firstName: "Dono",
        }),
      },
    });
    (provisionMembership as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      clinic: { id: "clinic-1" },
    });

    const result = await syncActiveClinic();

    expect(result.status).toBe("success");
    expect(result.message).toContain("sincronizada");
  });
});
