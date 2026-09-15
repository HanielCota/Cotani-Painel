import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  billingContract: { findMany: vi.fn() },
  rateLimit: { deleteMany: vi.fn(() => "rate-limits") },
  notification: { updateMany: vi.fn(() => "notifications") },
  webhookEvent: { deleteMany: vi.fn(() => "webhooks") },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
const cancelRemote = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/mercado-pago", () => ({ cancelMercadoPagoSubscription: cancelRemote }));

const { runDataMaintenance } = await import("@/server/services/maintenance");

describe("runDataMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica as políticas de retenção em uma transação", async () => {
    prismaMock.billingContract.findMany.mockResolvedValueOnce([]);
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 4 }, { count: 3 }, { count: 2 }]);

    const result = await runDataMaintenance(new Date("2026-08-20T12:00:00.000Z"));

    expect(result).toEqual({ redactedAbandonedCheckouts: 0, deletedRateLimits: 4, redactedNotifications: 3, deletedWebhookEvents: 2 });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { recipient: "[redacted]", content: "[redacted]", error: null, providerRef: null },
    }));
    expect(prismaMock.$transaction).toHaveBeenCalledWith(["rate-limits", "notifications", "webhooks"]);
  });

  it("pausa a cobrança e anonimiza checkout nunca pago após o prazo", async () => {
    const updatedAt = new Date("2026-07-01T00:00:00.000Z");
    prismaMock.billingContract.findMany.mockResolvedValueOnce([{ id: "contract-1", clinicId: "clinic-1", remoteId: "remote-1", updatedAt }]);
    cancelRemote.mockResolvedValueOnce(undefined);
    prismaMock.$transaction
      .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        billingContract: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        clinic: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }))
      .mockResolvedValueOnce([{ count: 4 }, { count: 3 }, { count: 2 }]);

    const result = await runDataMaintenance(new Date("2026-08-20T12:00:00.000Z"));

    expect(cancelRemote).toHaveBeenCalledWith("remote-1");
    expect(result.redactedAbandonedCheckouts).toBe(1);
  });

  it("preserva os dados se não conseguir interromper a assinatura remota", async () => {
    prismaMock.billingContract.findMany.mockResolvedValueOnce([{ id: "contract-1", clinicId: "clinic-1", remoteId: "remote-1", updatedAt: new Date() }]);
    cancelRemote.mockRejectedValueOnce(new Error("Mercado Pago indisponível"));
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }, { count: 0 }]);

    const result = await runDataMaintenance(new Date("2026-08-20T12:00:00.000Z"));

    expect(result.redactedAbandonedCheckouts).toBe(0);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
