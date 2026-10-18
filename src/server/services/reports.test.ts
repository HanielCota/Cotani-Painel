import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getReportsMetrics } from "@/server/services/reports";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

const clinic: ClinicModel = {
  billingReconciledAt: null,
  bookingLinkSharedAt: null,
  id: "clinic-1",
  legacyExternalId: "org_1",
  billingOwnerId: null,
  name: "Loja Teste",
  slug: "loja-teste",
  timeZone: "America/Sao_Paulo",
  contactEmail: null,
  phone: null,
  address: null,
  publicDescription: null,
  imageUrl: null,
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

function createAppointment(overrides: {
  id?: string;
  status: string;
  price: number;
  startTime: Date;
  paymentMethod?: string;
  serviceId?: string;
  serviceName?: string;
  professionalId?: string;
  professionalName?: string | null;
}) {
  const serviceId = overrides.serviceId ?? `svc-${overrides.serviceName ?? "Serviço A"}`;
  const professionalId = overrides.professionalName
    ? (overrides.professionalId ?? `prof-${overrides.professionalName}`)
    : null;

  return {
    id: overrides.id ?? "app-1",
    startTime: overrides.startTime,
    endTime: new Date(overrides.startTime.getTime() + 30 * 60_000),
    status: overrides.status,
    paymentMethod: overrides.paymentMethod ?? "OTHER",
    totalPrice: overrides.price,
    notes: null,
    clinicId: clinic.id,
    customerId: "cust-1",
    serviceId,
    professionalId,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { name: "Cliente" },
    service: { name: overrides.serviceName ?? "Serviço A", price: overrides.price },
    professional: overrides.professionalName ? { name: overrides.professionalName } : null,
  };
}

describe("getReportsMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna contagens gerais e taxas do mês", async () => {
    const { getClinicDateBounds } = await import("@/lib/timezone");
    const { startOfMonth } = getClinicDateBounds(clinic.timeZone);

    prismaMock.appointment.count.mockResolvedValueOnce(10);
    prismaMock.customer.count.mockResolvedValueOnce(5);
    prismaMock.service.count.mockResolvedValueOnce(3);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({
        id: "app-1",
        status: "CONFIRMED",
        price: 50,
        startTime: new Date(startOfMonth.getTime() + 60 * 60_000),
        serviceName: "Serviço A",
      }),
      createAppointment({
        id: "app-2",
        status: "COMPLETED",
        price: 70,
        startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000),
        serviceName: "Serviço B",
      }),
      createAppointment({
        id: "app-3",
        status: "NO_SHOW",
        price: 40,
        startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000),
        serviceName: "Serviço A",
      }),
      createAppointment({
        id: "app-4",
        status: "CANCELED",
        price: 30,
        startTime: new Date(startOfMonth.getTime() + 4 * 60 * 60_000),
        serviceName: "Serviço B",
      }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getReportsMetrics(clinic);

    expect(metrics.totalAppointments).toBe(10);
    expect(metrics.totalCustomers).toBe(5);
    expect(metrics.totalServices).toBe(3);
    expect(metrics.activeCustomersThisMonth).toBe(1);
    expect(metrics.confirmationRate).toBe(67); // 2 confirmados/completados de 3 atendimentos não cancelados
    expect(metrics.noShowRate).toBe(33); // 1 no-show de 3 atendimentos não cancelados
    expect(metrics.periodAppointmentsTotal).toBe(4);
    expect(metrics.topServices).toHaveLength(2);
    expect(metrics.topServices[0]?.name).toBe("Serviço A");
    expect(metrics.topServices[0]?.count).toBe(2);
  });

  it("retorna ranking de profissionais do mês", async () => {
    const { getClinicDateBounds } = await import("@/lib/timezone");
    const { startOfMonth } = getClinicDateBounds(clinic.timeZone);

    prismaMock.appointment.count.mockResolvedValueOnce(0);
    prismaMock.customer.count.mockResolvedValueOnce(0);
    prismaMock.service.count.mockResolvedValueOnce(0);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({
        id: "app-1",
        status: "CONFIRMED",
        price: 50,
        startTime: new Date(startOfMonth.getTime() + 60 * 60_000),
        professionalName: "João",
      }),
      createAppointment({
        id: "app-2",
        status: "CONFIRMED",
        price: 70,
        startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000),
        professionalName: "João",
      }),
      createAppointment({
        id: "app-3",
        status: "CONFIRMED",
        price: 40,
        startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000),
        professionalName: "Pedro",
      }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getReportsMetrics(clinic);

    expect(metrics.topProfessionals).toHaveLength(2);
    expect(metrics.topProfessionals[0]?.name).toBe("João");
    expect(metrics.topProfessionals[0]?.count).toBe(2);
    expect(metrics.topProfessionals[1]?.name).toBe("Pedro");
    expect(metrics.topProfessionals[1]?.count).toBe(1);
  });
});
