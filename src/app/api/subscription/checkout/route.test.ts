import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  clinic: { findUniqueOrThrow: vi.fn(), update: vi.fn(), count: vi.fn() },
  billingContract: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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
  getPlanConfig: vi.fn(() => ({ price: 34.9, mercadoPagoPlanId: "plan-1" })),
}));

const { POST } = await import("@/app/api/subscription/checkout/route");
const { getApiTenant } = await import("@/server/tenant");
const { ensureCurrentAppUser } = await import("@/server/auth");
const { createSubscriptionCheckout, cancelMercadoPagoSubscription } = await import("@/server/services/mercado-pago");

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
    transaction.clinic.count.mockResolvedValue(0);
    transaction.professional.count.mockResolvedValue(0);
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

describe("limites e idempotência do checkout", () => {
  const clinic = { id: "clinic-1", hasPaidOnce: false, mercadoPagoSubscriptionId: "old", mercadoPagoCheckoutKey: "key" };
  const contract = { id: "key", state: "CREATING", plan: "ESSENTIAL", cycle: "MONTHLY", remotePlanId: "plan-1" };
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.clinic.count.mockResolvedValue(0);
    transaction.professional.count.mockResolvedValue(0);
    transaction.clinic.findUniqueOrThrow.mockResolvedValue(clinic);
    transaction.billingContract.findUnique.mockResolvedValue(contract);
    vi.mocked(getApiTenant).mockResolvedValue({ ok: true, context: { clinic } } as never);
    vi.mocked(ensureCurrentAppUser).mockResolvedValue({ appUser: { email: "test@example.com" } } as never);
    vi.mocked(cancelMercadoPagoSubscription).mockResolvedValue(undefined);
    vi.mocked(createSubscriptionCheckout).mockResolvedValue({ checkoutUrl: "https://example.com/checkout", mercadoPagoSubscriptionId: "new" });
  });
  const checkout = () => POST(request(JSON.stringify({ plan: "ESSENTIAL", cycle: "MONTHLY" })));
  it("bloqueia downgrade com unidades vinculadas", async () => {
    transaction.clinic.count.mockResolvedValue(1);
    expect((await checkout()).status).toBe(409);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it("bloqueia downgrade com profissionais excedentes", async () => {
    transaction.professional.count.mockResolvedValue(2);
    expect((await checkout()).status).toBe(409);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it("filial não pode contratar assinatura independente", async () => {
    transaction.clinic.findUniqueOrThrow.mockResolvedValue({ ...clinic, billingOwnerId: "owner" });
    expect((await checkout()).status).toBe(409);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it("cancelamento incerto impede segunda autorização recorrente", async () => {
    vi.mocked(cancelMercadoPagoSubscription).mockRejectedValue(new Error("timeout"));
    expect((await checkout()).status).toBe(500);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it("repete tentativa ambígua com a mesma chave", async () => {
    expect((await checkout()).status).toBe(200);
    expect(createSubscriptionCheckout).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "key", remotePlanId: "plan-1" }));
    expect(transaction.billingContract.create).not.toHaveBeenCalled();
  });
  it("não reutiliza chave entre planos diferentes", async () => {
    transaction.billingContract.findUnique.mockResolvedValue({ ...contract, plan: "PROFESSIONAL" });
    expect((await checkout()).status).toBe(409);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
  });
  it("retoma URL existente sem cancelar nem criar outra cobrança", async () => {
    transaction.clinic.findUniqueOrThrow.mockResolvedValue({ ...clinic, mercadoPagoCheckoutUrl: "https://example.com/checkout" });
    transaction.billingContract.findUnique.mockResolvedValue({ ...contract, state: "pending", checkoutUrl: "https://example.com/checkout" });
    expect((await checkout()).status).toBe(200);
    expect(createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(cancelMercadoPagoSubscription).not.toHaveBeenCalled();
  });
});
