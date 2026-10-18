import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  financialEntry: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn() }));
vi.mock("@/server/tenant", () => ({ getClinicForRoles: vi.fn() }));

const { saveFinancialEntry } = await import("@/server/actions/finance");
const { getClinicForRoles } = await import("@/server/tenant");

function clinic(subscriptionPlan: string) {
  return {
    id: "clinic-1", timeZone: "America/Sao_Paulo", subscriptionPlan,
    subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00Z"),
  };
}

function entryForm(fields: Record<string, string>) {
  const data = new FormData();
  const defaults = { type: "INCOME", status: "PENDING", description: "Venda", amount: "100", occurredAt: "2026-10-01" };
  for (const [key, value] of Object.entries({ ...defaults, ...fields })) data.set(key, value);
  return data;
}

function savedData() {
  return prismaMock.financialEntry.create.mock.calls[0]?.[0]?.data as { occurredAt: Date; status: string; paidAmount: number } | undefined;
}

function dayInSaoPaulo(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

describe("saveFinancialEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClinicForRoles).mockResolvedValue(clinic("PROFESSIONAL") as never);
  });

  it("grava a data escolhida no mesmo dia do fuso da loja", async () => {
    await saveFinancialEntry({ status: "idle" } as never, entryForm({ occurredAt: "2026-10-01" }));

    expect(dayInSaoPaulo(savedData()!.occurredAt)).toBe("2026-10-01");
  });

  it("marcar Pago sem informar o valor quita o lançamento inteiro", async () => {
    await saveFinancialEntry({ status: "idle" } as never, entryForm({ status: "PAID", amount: "100" }));

    expect(savedData()).toMatchObject({ status: "PAID", paidAmount: 100 });
  });
  it("recusa o financeiro em plano que não tem o módulo", async () => {
    vi.mocked(getClinicForRoles).mockResolvedValueOnce(clinic("ESSENTIAL") as never);

    const result = await saveFinancialEntry({ status: "idle" } as never, entryForm({}));

    expect(result.status).toBe("error");
    expect(prismaMock.financialEntry.create).not.toHaveBeenCalled();
  });
});
