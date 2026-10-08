import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ default: { $queryRaw: queryRaw } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

const { GET, HEAD } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 200 quando o banco responde", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ status: "ok", checks: { database: "ok" } });
  });

  it("responde 503 sem expor o erro quando o banco falha", async () => {
    queryRaw.mockRejectedValueOnce(new Error("password authentication failed for user cotani"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "degraded", checks: { database: "error" } });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("considera o banco indisponível após o tempo limite", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValueOnce(new Promise(() => undefined));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3_000);
    const response = await pending;
    vi.useRealTimers();
    expect(response.status).toBe(503);
  });

  it("HEAD devolve só o status", async () => {
    queryRaw.mockResolvedValueOnce([]);
    const response = await HEAD();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
