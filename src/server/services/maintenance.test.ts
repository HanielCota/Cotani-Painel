import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  rateLimit: { deleteMany: vi.fn(() => "rate-limits") },
  notification: { updateMany: vi.fn(() => "notifications") },
  webhookEvent: { deleteMany: vi.fn(() => "webhooks") },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const { runDataMaintenance } = await import("@/server/services/maintenance");

describe("runDataMaintenance", () => {
  it("aplica as políticas de retenção em uma transação", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 4 }, { count: 3 }, { count: 2 }]);

    const result = await runDataMaintenance(new Date("2026-08-20T12:00:00.000Z"));

    expect(result).toEqual({ deletedRateLimits: 4, redactedNotifications: 3, deletedWebhookEvents: 2 });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { recipient: "[redacted]", content: "[redacted]", error: null, providerRef: null },
    }));
    expect(prismaMock.$transaction).toHaveBeenCalledWith(["rate-limits", "notifications", "webhooks"]);
  });
});
