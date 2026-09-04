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
      clinic: { findUnique: vi.fn() },
    },
  };
});

import prismaModule from "@/lib/prisma";
import { GET } from "@/app/api/jobs/notifications/route";

const prisma = prismaModule as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  clinic: { findUnique: ReturnType<typeof vi.fn> };
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

  it.each(["INACTIVE", "ACTIVE"])("cancela SMS incompatível com plano atual (%s)", async (status) => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: "n-1" }]);
    prisma.notification.findMany.mockResolvedValueOnce([{ id: "n-1", clinicId: "clinic", channel: "SMS" }]);
    prisma.clinic.findUnique.mockResolvedValueOnce({ operationalStatus: "ACTIVE", subscriptionStatus: status,
      subscriptionPlan: "PROFESSIONAL", subscriptionExpiresAt: new Date("2099-01-01") });
    const response = await GET(new Request("http://localhost/api/jobs/notifications", {
      headers: { authorization: "Bearer cron-secret" },
    }) as unknown as import("next/server").NextRequest);
    expect((await response.json()).sent).toBe(0);
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELED" }) }));
  });
});
