import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getTodayAppointments, getUpcomingAppointments } from "@/server/services/appointments";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

const clinic: ClinicModel = {
  id: "clinic-1",
  legacyExternalId: "org_1",
  billingOwnerId: null,
  name: "Barbearia Teste",
  slug: "barbearia-teste",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
  subscriptionPlan: "PROFESSIONAL",
  subscriptionCycle: "MONTHLY",
  pendingSubscriptionPlan: null,
  pendingSubscriptionCycle: null,
  trialEndsAt: null,
  mercadoPagoCheckoutKey: null,
  mercadoPagoCheckoutStartedAt: null,
  mercadoPagoCheckoutUrl: null,
  cancelAtPeriodEnd: false,
  subscriptionExpiresAt: null,
  hasPaidOnce: true,
  mercadoPagoSubscriptionId: null,
  maxAppointmentsPerDay: null,
  operationalStatus: "ACTIVE",
  suspensionReason: null,
  suspendedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getUpcomingAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista mapeada de agendamentos futuros", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      {
        id: "app-1",
        startTime: future,
        status: "CONFIRMED",
        customer: { name: "João" },
        service: { name: "Corte" },
      },
    ]);

    const result = await getUpcomingAppointments(clinic, 10);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "app-1",
      customerName: "João",
      serviceName: "Corte",
      startTime: future,
      status: "CONFIRMED",
    });
  });

  it("retorna lista vazia quando não há agendamentos", async () => {
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const result = await getUpcomingAppointments(clinic);

    expect(result).toEqual([]);
  });
});

describe("getTodayAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna agendamentos do dia atual no fuso da clínica", async () => {
    const { startOfToday } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      {
        id: "app-1",
        startTime: new Date(startOfToday.getTime() + 60 * 60 * 1000),
        status: "PENDING",
        customer: { name: "Maria" },
        service: { name: "Barba" },
      },
    ]);

    const result = await getTodayAppointments(clinic);

    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe("Maria");
    expect(result[0].serviceName).toBe("Barba");
  });
});
