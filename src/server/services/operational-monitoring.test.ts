import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ operationalEvent: { create: vi.fn() } }));
const loggerMock = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

const { monitorOperation } = await import("@/server/services/operational-monitoring");

describe("operational monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.operationalEvent.create.mockResolvedValue({ id: "event-1" });
  });

  it("registra execução bem-sucedida e preserva seu resultado", async () => {
    const result = await monitorOperation(
      { category: "JOB", operation: "test-job" },
      async () => 42,
      (value) => ({ status: "SUCCESS", summary: { result: value } }),
    );

    expect(result).toBe(42);
    expect(prismaMock.operationalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "JOB",
        operation: "test-job",
        status: "SUCCESS",
        summary: { result: 42 },
        durationMs: expect.any(Number),
        startedAt: expect.any(Date),
        finishedAt: expect.any(Date),
      }),
    });
  });

  it("não registra chamadas recusadas antes da operação", async () => {
    await monitorOperation({ category: "JOB", operation: "test-job" }, async () => "unauthorized", () => null);
    expect(prismaMock.operationalEvent.create).not.toHaveBeenCalled();
  });

  it("registra falha e propaga o erro original", async () => {
    const failure = new Error("Falha no provedor");
    await expect(monitorOperation({ category: "WEBHOOK", operation: "test-hook" }, async () => { throw failure; }))
      .rejects.toBe(failure);
    expect(prismaMock.operationalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: "WEBHOOK", status: "FAILURE", error: "Falha no provedor" }),
    });
  });

  it("não interrompe a rotina se o registro de monitoramento falhar", async () => {
    prismaMock.operationalEvent.create.mockRejectedValueOnce(new Error("Banco indisponível"));
    await expect(monitorOperation({ category: "JOB", operation: "test-job" }, async () => "ok")).resolves.toBe("ok");
    expect(loggerMock.warn).toHaveBeenCalledOnce();
  });
});
