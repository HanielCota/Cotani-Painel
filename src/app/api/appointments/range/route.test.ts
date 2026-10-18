import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  appointment: { findMany: vi.fn() },
  professional: { findFirst: vi.fn(), findMany: vi.fn() },
  businessHour: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/api-rate-limit", () => ({ checkApiRateLimit: vi.fn(async () => null) }));
vi.mock("@/server/tenant", () => ({ getApiTenant: vi.fn() }));

const { GET } = await import("@/app/api/appointments/range/route");
const { getApiTenant } = await import("@/server/tenant");

const clinic = { id: "clinic-1", timeZone: "America/Sao_Paulo" };

function tenant(role: "ADMIN" | "PROVIDER") {
  vi.mocked(getApiTenant).mockResolvedValue({ ok: true, context: { clinic, membership: { id: "m-1" }, role } } as never);
}

function request(query: string) {
  return new NextRequest(`https://painel.cotani.com.br/api/appointments/range?${query}`);
}

describe("GET /api/appointments/range", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.professional.findMany.mockResolvedValue([{ id: "p-1", name: "Ana" }]);
    prismaMock.businessHour.findMany.mockResolvedValue([]);
  });

  it("busca o intervalo de dias no fuso do negócio, limitado a 7 dias", async () => {
    tenant("ADMIN");
    const response = await GET(request("from=2026-10-19&days=30"));
    const body = await response.json();

    expect(body).toMatchObject({ from: "2026-10-19", days: 7, professionals: [{ id: "p-1", name: "Ana" }] });
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where.clinicId).toBe("clinic-1");
    expect(where.startTime.lt.toISOString()).toBe("2026-10-26T03:00:00.000Z"); // 26/10 00:00 em SP
    expect(where.endTime.gt.toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(where.professionalId).toBeUndefined();
  });

  it("profissional (PROVIDER) vê só a própria agenda", async () => {
    tenant("PROVIDER");
    prismaMock.professional.findFirst.mockResolvedValue({ id: "p-9", name: "Bia" });

    const body = await (await GET(request("from=2026-10-19&days=1"))).json();

    expect(prismaMock.appointment.findMany.mock.calls[0][0].where.professionalId).toBe("p-9");
    expect(body.professionals).toEqual([{ id: "p-9", name: "Bia" }]);
    expect(prismaMock.professional.findMany).not.toHaveBeenCalled();
  });

  it("PROVIDER sem profissional vinculado recebe agenda vazia, sem consultar atendimentos", async () => {
    tenant("PROVIDER");
    prismaMock.professional.findFirst.mockResolvedValue(null);

    const body = await (await GET(request("days=1"))).json();

    expect(body.items).toEqual([]);
    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
  });

  it("sem login ou sem permissão, devolve o erro do tenant", async () => {
    vi.mocked(getApiTenant).mockResolvedValue({ ok: false, status: 401, message: "Não autenticado." } as never);
    const response = await GET(request("days=1"));
    expect(response.status).toBe(401);
    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
  });

  it("data inválida usa hoje no fuso do negócio", async () => {
    tenant("ADMIN");
    const body = await (await GET(request("from=2026-99-99&days=abc"))).json();
    expect(body.days).toBe(1);
    expect(body.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
