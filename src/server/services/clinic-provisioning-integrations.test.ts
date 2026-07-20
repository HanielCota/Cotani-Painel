import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  generateClinicSlug,
  softDeleteClinic,
  upsertClinic,
} from "@/server/services/clinic-provisioning";
import { SubscriptionStatus } from "@/generated/prisma/enums";

const baseClinic = {
  id: "clinic-1",
  clerkOrgId: "org_abc123",
  name: "Barbearia Original",
  slug: "barbearia-original-c123",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: SubscriptionStatus.INACTIVE,
  subscriptionPlan: null,
  subscriptionExpiresAt: null,
  hasPaidOnce: false,
  mercadoPagoSubscriptionId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("upsertClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria clínica com slug gerado quando não existe", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce(null);
    prismaMock.clinic.create.mockResolvedValueOnce({ ...baseClinic, name: "Barbearia Nova" });

    const result = await upsertClinic({ clerkOrgId: "org_abc123", name: "Barbearia Nova" });

    expect(prismaMock.clinic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clerkOrgId: "org_abc123",
        name: "Barbearia Nova",
        slug: generateClinicSlug("Barbearia Nova", "org_abc123"),
      }),
    });
    expect(result.name).toBe("Barbearia Nova");
  });

  it("não altera o slug quando a clínica já existe", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce(baseClinic);
    prismaMock.clinic.update.mockResolvedValueOnce({ ...baseClinic, name: "Barbearia Renomeada" });

    await upsertClinic({ clerkOrgId: "org_abc123", name: "Barbearia Renomeada" });

    const updateCall = prismaMock.clinic.update.mock.calls[0][0] as { data: { slug?: string } };
    expect(updateCall.data.slug).toBeUndefined();
  });

  it("preserva hasPaidOnce quando já foi pago", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ ...baseClinic, hasPaidOnce: true });
    prismaMock.clinic.update.mockResolvedValueOnce({ ...baseClinic, hasPaidOnce: true });

    await upsertClinic({ clerkOrgId: "org_abc123", name: "Barbearia Original" });

    const updateCall = prismaMock.clinic.update.mock.calls[0][0] as { data: { hasPaidOnce: boolean } };
    expect(updateCall.data.hasPaidOnce).toBe(true);
  });
});

describe("softDeleteClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marca deletedAt sem excluir registros", async () => {
    prismaMock.clinic.updateMany.mockResolvedValueOnce({ count: 1 });

    await softDeleteClinic("org_abc123");

    expect(prismaMock.clinic.updateMany).toHaveBeenCalledWith({
      where: { clerkOrgId: "org_abc123", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
