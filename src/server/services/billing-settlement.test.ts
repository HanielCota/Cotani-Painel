import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  contract: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  clinic: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  history: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
  professional: { count: vi.fn() }, remote: vi.fn(), invoice: vi.fn(), lock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const db = { billingContract: mocks.contract, clinic: mocks.clinic, paymentHistory: mocks.history,
    professional: mocks.professional, $executeRaw: mocks.lock };
  return { default: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } };
});
vi.mock("./mercado-pago", async (original) => ({
  ...await original<typeof import("./mercado-pago")>(), syncSubscriptionFromMercadoPago: mocks.remote, getInvoiceFromMercadoPago: mocks.invoice,
}));
const { settleSubscription } = await import("./billing-settlement");
const end = new Date("2099-02-01T12:00:00Z");
const contract = { id: "attempt", clinicId: "clinic", remoteId: "remote", plan: "PROFESSIONAL", cycle: "MONTHLY", amount: 49.99, currency: "BRL", remotePlanId: "plan" };
const clinic = { id: "clinic", mercadoPagoSubscriptionId: "remote", subscriptionExpiresAt: end };
const coverage = { plan: "PROFESSIONAL", billingCycle: "MONTHLY", periodEndsAt: end };
describe("liquidação de assinaturas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.contract.findUnique.mockResolvedValue(contract);
    mocks.clinic.findUniqueOrThrow.mockResolvedValue(clinic);
    mocks.clinic.count.mockResolvedValue(0);
    mocks.professional.count.mockResolvedValue(1);
    mocks.remote.mockResolvedValue({ externalReference: "clinic", planId: "plan", rawStatus: "authorized", status: null, amount: 49.99, currency: "BRL" });
    mocks.invoice.mockResolvedValue({ id: "invoice", subscriptionId: "remote", paymentId: "payment", status: "approved",
      amount: 49.99, currency: "BRL", paidAt: new Date("2099-01-01T12:00:00Z") });
    mocks.history.findUnique.mockResolvedValue(null);
    mocks.history.findFirst.mockResolvedValue(coverage);
  });
  it("autorização sem pagamento nunca ativa nem estende a assinatura", async () => {
    await settleSubscription("remote");
    expect(mocks.clinic.update).not.toHaveBeenCalled();
    expect(mocks.history.upsert).not.toHaveBeenCalled();
  });
  it("pagamento aprovado registra período fixo e libera o plano contratado", async () => {
    await settleSubscription("remote", "invoice");
    expect(mocks.history.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ periodEndsAt: end, status: "approved" }) }));
    expect(mocks.clinic.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "ACTIVE", subscriptionPlan: "PROFESSIONAL", hasPaidOnce: true }) }));
  });
  it.each([{ currency: "USD" }, { amount: 1 }, { subscriptionId: "other" }])("rejeita fatura divergente %j", async (change) => {
    mocks.invoice.mockResolvedValue({ subscriptionId: "remote", paymentId: "payment", status: "approved", amount: 49.99, currency: "BRL", ...change });
    await expect(settleSubscription("remote", "invoice")).rejects.toThrow("Fatura diverge");
    expect(mocks.clinic.update).not.toHaveBeenCalled();
  });
  it("não aceita apenas external_reference para vincular contrato desconhecido", async () => {
    mocks.contract.findUnique.mockResolvedValue(null);
    mocks.clinic.findUnique.mockResolvedValue(null);
    await expect(settleSubscription("old-remote")).rejects.toThrow("não vinculado");
    expect(mocks.remote).not.toHaveBeenCalled();
  });
  it("cancelamento antigo não cancela o contrato atual", async () => {
    mocks.clinic.findUniqueOrThrow.mockResolvedValue({ ...clinic, mercadoPagoSubscriptionId: "new-remote" });
    mocks.remote.mockResolvedValue({ externalReference: "clinic", planId: "plan", rawStatus: "cancelled", amount: 49.99, currency: "BRL" });
    await settleSubscription("remote");
    expect(mocks.clinic.update).not.toHaveBeenCalled();
  });
  it("cancelar renovação preserva a data paga, sem inventar outro período", async () => {
    mocks.remote.mockResolvedValue({ externalReference: "clinic", planId: "plan", rawStatus: "cancelled", amount: 49.99, currency: "BRL" });
    await settleSubscription("remote");
    expect(mocks.clinic.update).toHaveBeenCalledWith({ where: { id: "clinic" }, data: { cancelAtPeriodEnd: true } });
  });
  it("reentrega de pagamento não recalcula período já registrado", async () => {
    mocks.history.findUnique.mockResolvedValue({ clinicId: "clinic", mercadoPagoSubscriptionId: "remote", periodEndsAt: end });
    await settleSubscription("remote", "invoice");
    expect(mocks.history.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ periodEndsAt: end }) }));
  });
  it("estorno remove apenas o período que ele sustentava", async () => {
    mocks.history.findUnique.mockResolvedValue({ clinicId: "clinic", mercadoPagoSubscriptionId: "remote", periodEndsAt: end });
    mocks.invoice.mockResolvedValue({ subscriptionId: "remote", paymentId: "payment", status: "refunded", amount: 49.99, currency: "BRL" });
    mocks.history.findFirst.mockResolvedValue(null);
    await settleSubscription("remote", "invoice");
    expect(mocks.clinic.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "INACTIVE" }) }));
  });
  it("estorno não retira acesso coberto por outro pagamento aprovado", async () => {
    mocks.history.findUnique.mockResolvedValue({ clinicId: "clinic", mercadoPagoSubscriptionId: "remote", periodEndsAt: end });
    mocks.invoice.mockResolvedValue({ subscriptionId: "remote", paymentId: "payment", status: "refunded", amount: 49.99, currency: "BRL" });
    await settleSubscription("remote", "invoice");
    expect(mocks.clinic.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "ACTIVE" }) }));
  });
  it("confere profissionais novamente na ativação", async () => {
    mocks.professional.count.mockResolvedValue(4);
    await expect(settleSubscription("remote", "invoice")).rejects.toThrow("Desative os excedentes");
    expect(mocks.clinic.update).not.toHaveBeenCalled();
  });
  it("não mantém unidades ao ativar plano sem múltiplas unidades", async () => {
    mocks.clinic.count.mockResolvedValue(1);
    await expect(settleSubscription("remote", "invoice")).rejects.toThrow("somente uma unidade");
    expect(mocks.clinic.update).not.toHaveBeenCalled();
  });
  it("aceita checkout hospedado sem plano quando valor e moeda conferem", async () => {
    mocks.contract.findUnique.mockResolvedValue({ ...contract, remotePlanId: null });
    mocks.remote.mockResolvedValue({ externalReference: "clinic", rawStatus: "pending", status: null, amount: 49.99, currency: "BRL" });
    await expect(settleSubscription("remote")).resolves.toBeUndefined();
  });
  it("rejeita checkout hospedado com valor remoto divergente", async () => {
    mocks.contract.findUnique.mockResolvedValue({ ...contract, remotePlanId: null });
    mocks.remote.mockResolvedValue({ externalReference: "clinic", rawStatus: "pending", status: null, amount: 1, currency: "BRL" });
    await expect(settleSubscription("remote")).rejects.toThrow("valor ou da moeda");
  });
});
