import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  clinic: { findUnique: vi.fn(), update: vi.fn() },
  paymentHistory: { upsert: vi.fn() },
  webhookEvent: { create: vi.fn() },
};
const prismaMock = {
  webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
};

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/services/mercado-pago", () => ({
  validateMercadoPagoWebhook: vi.fn(),
  syncSubscriptionFromMercadoPago: vi.fn(),
  getInvoiceFromMercadoPago: vi.fn(),
}));

const { POST } = await import("@/app/api/webhooks/mercado-pago/route");
const { getInvoiceFromMercadoPago } = await import("@/server/services/mercado-pago");

describe("webhook Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null);
  });

  it("concilia cada pagamento autorizado com valor e data reais", async () => {
    vi.mocked(getInvoiceFromMercadoPago).mockResolvedValueOnce({
      id: "invoice-1",
      subscriptionId: "subscription-1",
      paymentId: "payment-1",
      amount: 97,
      status: "approved",
      paidAt: new Date("2026-08-20T12:00:00.000Z"),
    });
    tx.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1", subscriptionPlan: "MONTHLY" });

    const request = new NextRequest("https://painel.cotani.com.br/api/webhooks/mercado-pago", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "request-1" },
      body: JSON.stringify({
        id: 123,
        type: "subscription_authorized_payment",
        action: "payment.updated",
        data: { id: "invoice-1" },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(tx.paymentHistory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { mercadoPagoPaymentId: "payment-1" },
      create: expect.objectContaining({ amount: 97, status: "approved" }),
    }));
    expect(tx.clinic.update).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: { subscriptionStatus: "ACTIVE", hasPaidOnce: true },
    });
    expect(tx.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "123", type: "payment.updated" }),
    });
  });

  it("ignora uma notificação já processada", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValueOnce({ id: "event-1" });
    const request = new NextRequest("https://painel.cotani.com.br/api/webhooks/mercado-pago", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 123, type: "subscription_preapproval", data: { id: "subscription-1" } }),
    });

    const response = await POST(request);
    expect(await response.json()).toEqual({ received: true, skipped: true });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
