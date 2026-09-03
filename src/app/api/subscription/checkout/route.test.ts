import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  $queryRaw: vi.fn(),
  clinic: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  professional: { count: vi.fn() },
};
const prismaMock = {
  $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
  clinic: { update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/tenant", () => ({ getApiTenant: vi.fn() }));
vi.mock("@/server/auth", () => ({ ensureCurrentAppUser: vi.fn() }));
vi.mock("@/server/services/mercado-pago", () => ({
  cancelMercadoPagoSubscription: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
}));

const { POST } = await import("@/app/api/subscription/checkout/route");
const { getApiTenant } = await import("@/server/tenant");
const { ensureCurrentAppUser } = await import("@/server/auth");

function request(body: string) {
  return new NextRequest("https://painel.cotani.com.br/api/subscription/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("checkout de assinatura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita JSON inválido", async () => {
    vi.mocked(getApiTenant).mockResolvedValueOnce({ ok: true, context: { clinic: { id: "clinic-1" } } } as never);
    vi.mocked(ensureCurrentAppUser).mockResolvedValueOnce({ appUser: { email: "cliente@cotani.com.br" } } as never);
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
  });

  it("preserva o status de autenticação e autorização", async () => {
    vi.mocked(getApiTenant).mockResolvedValueOnce({ ok: false, status: 401, message: "Sessão expirada." });
    const response = await POST(request(JSON.stringify({ plan: "ESSENTIAL", cycle: "MONTHLY" })));
    expect(response.status).toBe(401);
  });

  it("não cria cobrança duplicada para assinatura paga ainda ativa", async () => {
    const clinic = {
      id: "clinic-1",
      hasPaidOnce: true,
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    };
    vi.mocked(getApiTenant).mockResolvedValueOnce({ ok: true, context: { clinic } } as never);
    vi.mocked(ensureCurrentAppUser).mockResolvedValueOnce({ appUser: { email: "cliente@cotani.com.br" } } as never);
    transaction.clinic.findUniqueOrThrow.mockResolvedValueOnce(clinic);

    const response = await POST(request(JSON.stringify({ plan: "ESSENTIAL", cycle: "MONTHLY" })));
    expect(response.status).toBe(409);
    expect(transaction.clinic.update).not.toHaveBeenCalled();
  });

  it("não expõe detalhes internos em falhas inesperadas", async () => {
    vi.mocked(getApiTenant).mockRejectedValueOnce(new Error("postgresql://usuario:senha@host/banco"));

    const response = await POST(request(JSON.stringify({ plan: "ESSENTIAL", cycle: "MONTHLY" })));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Não foi possível iniciar o checkout. Tente novamente.");
    expect(body.message).not.toContain("postgresql");
  });
});
