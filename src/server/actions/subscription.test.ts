import { describe, expect, it, vi } from "vitest";

import { cancelSubscription } from "@/server/actions/subscription";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import * as tenantModule from "@/server/tenant";

vi.mock("@/server/tenant", () => ({
  getTenantContext: vi.fn(),
  requireRole: vi.fn((tenant) => tenant),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    clinic: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
    },
  },
}));

const mockedGetTenantContext = vi.mocked(tenantModule.getTenantContext);
const mockedPrismaClinicUpdate = vi.mocked(prisma.clinic.update);

describe("cancelSubscription", () => {
  it("retorna erro quando não há tenant", async () => {
    mockedGetTenantContext.mockResolvedValueOnce(null as unknown as tenantModule.TenantContext);

    const result = await cancelSubscription();

    expect(result.status).toBe("error");
    expect(result.message).toContain("Nenhuma loja encontrada");
  });

  it("retorna erro quando a assinatura não está ativa", async () => {
    mockedGetTenantContext.mockResolvedValueOnce({
      clinic: {
        id: "clinic-1",
        subscriptionStatus: SubscriptionStatus.INACTIVE,
        mercadoPagoSubscriptionId: null,
      },
      membership: { id: "membership-1" },
    } as Awaited<ReturnType<typeof tenantModule.getTenantContext>>);

    const result = await cancelSubscription();

    expect(result.status).toBe("error");
    expect(result.message).toContain("Não há assinatura ativa");
  });

  it("não simula cancelamento quando falta o vínculo com Mercado Pago", async () => {
    mockedGetTenantContext.mockResolvedValueOnce({
      clinic: {
        id: "clinic-1",
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        mercadoPagoSubscriptionId: null,
      },
      membership: { id: "membership-1" },
    } as Awaited<ReturnType<typeof tenantModule.getTenantContext>>);

    const result = await cancelSubscription();

    expect(result.status).toBe("error");
    expect(result.message).toContain("Mercado Pago");
    expect(mockedPrismaClinicUpdate).not.toHaveBeenCalled();
  });

  it("impede que administrador de filial cancele a assinatura da unidade principal", async () => {
    mockedGetTenantContext.mockResolvedValueOnce({
      clinic: {
        id: "branch-1",
        billingOwnerId: "owner-1",
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
      membership: { id: "membership-1", userId: "user-branch" },
    } as Awaited<ReturnType<typeof tenantModule.getTenantContext>>);
    vi.mocked(prisma.membership.findUnique).mockResolvedValueOnce(null);

    const result = await cancelSubscription();

    expect(result.status).toBe("error");
    expect(result.message).toContain("unidade principal");
    expect(prisma.clinic.findUnique).not.toHaveBeenCalled();
  });
});
