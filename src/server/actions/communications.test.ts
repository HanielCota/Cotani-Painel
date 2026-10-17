import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notification: { updateMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn() }));
vi.mock("@/server/tenant", () => ({ getClinicForRoles: vi.fn() }));

const { retryNotification } = await import("@/server/actions/communications");
const { getClinicForRoles } = await import("@/server/tenant");

function retryForm() {
  const data = new FormData();
  data.set("id", "550e8400-e29b-41d4-a716-446655440030");
  return data;
}

describe("retryNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("não reenvia mensagem com a assinatura vencida", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValueOnce({
      id: "clinic-1", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2020-01-01T00:00:00Z"),
    } as never);

    const result = await retryNotification({ status: "idle" } as never, retryForm());

    expect(result.status).toBe("error");
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled();
  });

  it("reenvia com a assinatura ativa", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValueOnce({
      id: "clinic-1", subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00Z"),
    } as never);

    const result = await retryNotification({ status: "idle" } as never, retryForm());

    expect(result.status).toBe("success");
  });
});
