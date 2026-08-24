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

  it("não reivindica notificações WHATSAPP no modo manual", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const request = new Request("http://localhost/api/jobs/notifications", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);
    const body = await response.json();

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.sent).toBe(0);
    expect(body.retried).toBe(0);
    expect(body.failed).toBe(0);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});
