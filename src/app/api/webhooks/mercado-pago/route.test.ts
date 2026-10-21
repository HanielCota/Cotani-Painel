import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), upsert: vi.fn(), settle: vi.fn(), validate: vi.fn(), invoice: vi.fn(), search: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { webhookEvent: { findUnique: mocks.findUnique, upsert: mocks.upsert } } }));
vi.mock("@/server/services/billing-settlement", () => ({ settleSubscription: mocks.settle }));
vi.mock("@/server/services/mercado-pago", () => ({
  validateMercadoPagoWebhook: mocks.validate, getInvoiceFromMercadoPago: mocks.invoice, searchSubscriptionInvoices: mocks.search,
}));
const { POST } = await import("./route");
function request(type = "subscription_preapproval", id = "subscription-1") {
  return new NextRequest("https://painel.cotani.com.br/api/webhooks/mercado-pago", {
    method: "POST", headers: { "content-type": "application/json", "x-request-id": "req-1" },
    body: JSON.stringify({ id: "event-1", type, data: { id } }),
  });
}
describe("webhook Mercado Pago", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.findUnique.mockResolvedValue(null); });
  it("valida assinatura antes de consultar ou alterar dados", async () => {
    mocks.validate.mockImplementation(() => { throw new Error("invalid"); });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("encaminha autorização sem interpretá-la como pagamento", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledWith("subscription-1");
  });
  it("concilia a fatura vinculada à assinatura", async () => {
    mocks.invoice.mockResolvedValue({ subscriptionId: "subscription-1" });
    expect((await POST(request("subscription_authorized_payment", "invoice-1"))).status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledWith("subscription-1", "invoice-1");
  });
  it("processa atualizações de pagamento incluindo estornos", async () => {
    mocks.search.mockResolvedValue(["invoice-1"]);
    mocks.invoice.mockResolvedValue({ subscriptionId: "subscription-1" });
    expect((await POST(request("payment", "123"))).status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith(undefined, "123");
    expect(mocks.settle).toHaveBeenCalledWith("subscription-1", "invoice-1");
  });
  it("não registra sucesso se a conciliação falhar", async () => {
    mocks.settle.mockRejectedValue(new Error("unlinked"));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("recusa corpo fora do formato da notificação", async () => {
    const invalid = new NextRequest("https://painel.cotani.com.br/api/webhooks/mercado-pago", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: 42, data: { id: { nested: true } } }),
    });
    expect((await POST(invalid)).status).toBe(400);
    expect(mocks.validate).not.toHaveBeenCalled();
  });
  it("guarda a notificação inteira no registro do evento", async () => {
    const notification = {
      id: 123, type: "subscription_preapproval", action: "updated", live_mode: true,
      date_created: "2026-10-18T12:00:00Z", user_id: 456, data: { id: "subscription-1", extra: "kept" },
    };
    const full = new NextRequest("https://painel.cotani.com.br/api/webhooks/mercado-pago", {
      method: "POST", headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: JSON.stringify(notification),
    });
    expect((await POST(full)).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ payloadSnapshot: notification }) }),
    );
  });
  it("ignora a notificação já processada", async () => {
    mocks.findUnique.mockResolvedValue({ id: "event-1" });
    expect(await (await POST(request())).json()).toEqual({ received: true, skipped: true });
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});
