import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const $transaction = vi.fn();
  const $queryRaw = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const findMany = vi.fn();

  return {
    default: {
      $transaction,
      $queryRaw,
      notification: { update, updateMany, findMany },
    },
  };
});

import prismaModule from "@/lib/prisma";
import { GET } from "@/app/api/jobs/notifications/route";

const prisma = prismaModule as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  notification: {
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const originalEnv = process.env;

describe("/api/jobs/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "cron-secret", WHATSAPP_SENDER_MODE: "manual" };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("retorna 401 quando o secret do cron está incorreto", async () => {
    const request = new Request("http://localhost/api/jobs/notifications", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);

    expect(response.status).toBe(401);
  });

  it("pula notificações WHATSAPP no modo manual e libera o lock", async () => {
    const notification = {
      id: "notif-1",
      channel: "WHATSAPP",
      recipient: "5511999999999",
      content: "Confirmação",
      idempotencyKey: "key-1",
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: new Date(),
      nextAttemptAt: new Date(),
      lockedAt: new Date(),
    };

    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: notification.id }]);
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([notification]);

    const request = new Request("http://localhost/api/jobs/notifications", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);
    const body = await response.json();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenCalled();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.retried).toBe(0);
    expect(body.failed).toBe(0);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: notification.id },
      data: { lockedAt: null },
    });
  });
});
