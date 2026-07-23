import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/billing", () => ({
  expireSubscriptions: vi.fn(),
}));

import { GET } from "@/app/api/jobs/billing/expire-subscriptions/route";
import { expireSubscriptions } from "@/server/services/billing";

const originalEnv = process.env;

describe("/api/jobs/billing/expire-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "cron-secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("retorna 401 quando o secret do cron está incorreto", async () => {
    const request = new Request("http://localhost/api/jobs/billing/expire-subscriptions", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);

    expect(response.status).toBe(401);
  });

  it("executa expireSubscriptions e retorna a contagem", async () => {
    (expireSubscriptions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ expired: 3 });

    const request = new Request("http://localhost/api/jobs/billing/expire-subscriptions", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request as unknown as import("next/server").NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.expired).toBe(3);
    expect(expireSubscriptions).toHaveBeenCalled();
  });
});
