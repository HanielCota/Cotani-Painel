import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  findUser: vi.fn(),
  findContract: vi.fn(),
  createClinic: vi.fn(),
  updateClinic: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  createRemote: vi.fn(),
}));
const tx = {
  $executeRaw: mocks.lock,
  user: { findFirst: mocks.findUser },
  clinic: { create: mocks.createClinic, update: mocks.updateClinic },
  billingContract: {
    findFirst: mocks.findContract,
    create: mocks.createContract,
    update: mocks.updateContract,
  },
};
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
  },
}));
vi.mock("./mercado-pago", () => ({
  getPlanConfig: () => ({ price: 49.99 }),
  createSubscriptionCheckout: mocks.createRemote,
}));

const { createLandingCheckout, LandingCheckoutConflictError } = await import("./landing-checkout");
const input = {
  name: "Maria Silva",
  email: "maria@example.com",
  business: "Studio Beleza",
  phone: "(11) 99999-9999",
  plan: "PROFESSIONAL" as const,
  cycle: "MONTHLY" as const,
};

describe("ponte de checkout da landing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUser.mockResolvedValue(null);
    mocks.findContract.mockResolvedValue(null);
    mocks.createContract.mockImplementation(({ data }: { data: { id: string; clinicId: string } }) => ({ ...data, clinic: { id: data.clinicId } }));
    mocks.createRemote.mockResolvedValue({ checkoutUrl: "https://mercadopago.com/checkout", mercadoPagoSubscriptionId: "remote-1" });
  });

  it("cria empresa provisória e usa o contrato como chave idempotente", async () => {
    const result = await createLandingCheckout(input);
    const contract = mocks.createContract.mock.calls[0][0].data;
    expect(result.checkoutUrl).toBe("https://mercadopago.com/checkout");
    expect(mocks.createRemote).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: contract.clinicId,
      idempotencyKey: contract.id,
      payerEmail: input.email,
    }));
    expect(mocks.updateClinic).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mercadoPagoSubscriptionId: "remote-1" }) }));
  });

  it("repete tentativa ambígua com a mesma chave sem criar outra empresa", async () => {
    mocks.findContract.mockResolvedValue({
      id: "contract-1", clinicId: "clinic-1", clinic: { id: "clinic-1" },
      plan: "PROFESSIONAL", cycle: "MONTHLY", state: "CREATING", checkoutUrl: null,
    });
    await createLandingCheckout(input);
    expect(mocks.createClinic).not.toHaveBeenCalled();
    expect(mocks.createRemote).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "contract-1" }));
  });

  it("manda contas existentes gerenciarem o plano dentro do painel", async () => {
    mocks.findUser.mockResolvedValue({ id: "user-1" });
    await expect(createLandingCheckout(input)).rejects.toBeInstanceOf(LandingCheckoutConflictError);
    expect(mocks.createRemote).not.toHaveBeenCalled();
  });
});
