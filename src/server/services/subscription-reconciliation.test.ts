import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ clinics: vi.fn(), contracts: vi.fn(), updateClinic: vi.fn(), updateContract: vi.fn(), page: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  clinic: { findMany: m.clinics, update: m.updateClinic }, billingContract: { findMany: m.contracts, update: m.updateContract },
} }));
vi.mock("./mercado-pago", () => ({ getSubscriptionInvoicePage: m.page }));
vi.mock("./billing-settlement", () => ({ settleSubscription: m.settle }));
const { reconcileMercadoPagoSubscriptions } = await import("./subscription-reconciliation");
describe("recuperação de webhooks perdidos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.clinics.mockResolvedValue([{ id: "clinic", mercadoPagoSubscriptionId: "remote" }]);
    m.contracts.mockResolvedValue([{ id: "contract", remoteId: "remote", reconciliationOffset: 10 }]);
    m.page.mockResolvedValue({ invoices: ["invoice"], hasMore: false });
  });
  it("consulta e concilia pagamentos, não apenas autorização", async () => {
    expect(await reconcileMercadoPagoSubscriptions()).toEqual({ checked: 1, reconciled: 1, failed: 0, remainingInBatch: 0 });
    expect(m.page).toHaveBeenCalledWith("remote", 10);
    expect(m.settle).toHaveBeenCalledWith("remote", "invoice");
    expect(m.updateContract).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reconciliationOffset: 0 }) }));
  });
  it("expõe falha e gira a fila sem declarar sucesso", async () => {
    m.settle.mockRejectedValue(new Error("timeout"));
    const result = await reconcileMercadoPagoSubscriptions();
    expect(result.failed).toBe(1);
    expect(result.reconciled).toBe(0);
    expect(m.updateClinic).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "clinic" }, data: { billingReconciledAt: expect.any(Date) } }));
  });
  it("preserva cursor para a próxima página", async () => {
    m.page.mockResolvedValue({ invoices: ["invoice"], hasMore: true });
    await reconcileMercadoPagoSubscriptions();
    expect(m.updateContract).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reconciliationOffset: 11 }) }));
  });
});
