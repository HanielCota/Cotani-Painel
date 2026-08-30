import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    clinic: { findUnique: vi.fn() },
    service: { findFirst: vi.fn() },
    rateLimit: { upsert: vi.fn() },
  },
}));

vi.mock("@/server/services/availability", () => ({
  getAvailableSlots: vi.fn(),
}));

import { GET } from "@/app/api/public/[slug]/availability/route";
import prismaModule from "@/lib/prisma";
import { getAvailableSlots } from "@/server/services/availability";

const prisma = prismaModule as unknown as {
  clinic: { findUnique: ReturnType<typeof vi.fn> };
  service: { findFirst: ReturnType<typeof vi.fn> };
  rateLimit: { upsert: ReturnType<typeof vi.fn> };
};

describe("/api/public/[slug]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.rateLimit.upsert.mockResolvedValue({ count: 1, id: "rl-1", key: "key", windowStart: new Date(), resetAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  });

  it("retorna 429 quando rate limit é excedido", async () => {
    prisma.rateLimit.upsert.mockResolvedValueOnce({ count: 61, id: "rl-1", key: "key", windowStart: new Date(), resetAt: new Date(), createdAt: new Date(), updatedAt: new Date() });

    const request = new NextRequest(
      "http://localhost/api/public/loja/availability?serviceId=550e8400-e29b-41d4-a716-446655440001&date=2026-07-23",
      { headers: { "x-forwarded-for": "127.0.0.1" } },
    );

    const response = await GET(request, { params: Promise.resolve({ slug: "loja" }) });

    expect(response.status).toBe(429);
  });

  it("retorna slots quando parâmetros são válidos", async () => {
    prisma.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1", timeZone: "America/Sao_Paulo", maxAppointmentsPerDay: null, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"), operationalStatus: "ACTIVE", deletedAt: null });
    prisma.service.findFirst.mockResolvedValueOnce({ duration: 30 });
    (getAvailableSlots as ReturnType<typeof vi.fn>).mockResolvedValueOnce(["10:00", "10:30"]);

    const request = new NextRequest(
      "http://localhost/api/public/loja/availability?serviceId=550e8400-e29b-41d4-a716-446655440001&date=2026-07-23",
      { headers: { "x-forwarded-for": "127.0.0.1" } },
    );

    const response = await GET(request, { params: Promise.resolve({ slug: "loja" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slots).toEqual(["10:00", "10:30"]);
  });
});
