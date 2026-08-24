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
      update: vi.fn(),
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
    expect(result.message).toContain("Nenhuma barbearia encontrada");
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

  it("cancela assinatura localmente quando não há integração com Mercado Pago", async () => {
    mockedGetTenantContext.mockResolvedValueOnce({
      clinic: {
        id: "clinic-1",
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        mercadoPagoSubscriptionId: null,
      },
      membership: { id: "membership-1" },
    } as Awaited<ReturnType<typeof tenantModule.getTenantContext>>);

    mockedPrismaClinicUpdate.mockResolvedValueOnce({} as never);

    const result = await cancelSubscription();

    expect(result.status).toBe("success");
    expect(mockedPrismaClinicUpdate).toHaveBeenCalledWith({
      where: { id: "clinic-1" },
      data: { subscriptionStatus: SubscriptionStatus.CANCELED },
    });
  });
});
