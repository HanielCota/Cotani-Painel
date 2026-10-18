import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/operational-monitoring", () => ({
  getHttpOperationOutcome: vi.fn(() => null),
  monitorOperation: vi.fn((_input: unknown, run: () => Promise<unknown>) => run()),
}));

const { cronJob } = await import("@/server/cron-job");

function request(authorization?: string) {
  return new NextRequest("https://painel.example.com/api/jobs/x", {
    headers: authorization ? { authorization } : {},
  });
}

describe("cronJob", () => {
  const run = vi.fn(async () => NextResponse.json({ ok: true }));
  const { GET, POST } = cronJob({ operation: "teste", run });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "segredo-de-teste";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("executa a tarefa com o Bearer correto (GET e POST)", async () => {
    expect((await GET(request("Bearer segredo-de-teste"))).status).toBe(200);
    expect((await POST(request("Bearer segredo-de-teste"))).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("recusa sem token ou com token errado, sem executar", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer outro"))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("falha fechado quando CRON_SECRET não está configurado", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request("Bearer "))).status).toBe(500);
    expect(run).not.toHaveBeenCalled();
  });
});
