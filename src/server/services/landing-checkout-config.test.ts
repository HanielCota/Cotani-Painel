import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClinic: vi.fn(),
  createContract: vi.fn(),
  createRemote: vi.fn(),
}));
const tx = {
  $executeRaw: vi.fn(),
  user: { findFirst: vi.fn(async () => null) },
  clinic: { create: mocks.createClinic, update: vi.fn() },
  billingContract: { findFirst: vi.fn(async () => null), create: mocks.createContract, update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
  },
}));
// Só a chamada ao Mercado Pago é falsa: a validação da configuração é a real.
vi.mock("./mercado-pago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mercado-pago")>()),
  createSubscriptionCheckout: mocks.createRemote,
}));

const { createLandingCheckout } = await import("./landing-checkout");
const input = {
  name: "Maria Silva",
  email: "maria@example.com",
  business: "Studio Beleza",
  phone: "(11) 99999-9999",
  plan: "PROFESSIONAL" as const,
  cycle: "MONTHLY" as const,
};

describe("checkout da landing com configuração inválida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "test-token");
    vi.stubEnv("MERCADO_PAGO_PROFESSIONAL_MONTHLY_PLAN_ID", "test-plan");
    mocks.createContract.mockImplementation(({ data }: { data: { id: string; clinicId: string } }) => ({ ...data, clinic: { id: data.clinicId } }));
    mocks.createRemote.mockResolvedValue({ checkoutUrl: "https://mercadopago.com/checkout", mercadoPagoSubscriptionId: "remote-1" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("não grava loja nem contrato quando o retorno não é HTTPS público", async () => {
    vi.stubEnv("LANDING_PAGE_URL", "http://localhost:4321");

    await expect(createLandingCheckout(input)).rejects.toThrow(/HTTPS/);
    expect(mocks.createClinic).not.toHaveBeenCalled();
    expect(mocks.createContract).not.toHaveBeenCalled();
    expect(mocks.createRemote).not.toHaveBeenCalled();
  });
});
