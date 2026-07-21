import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getReportsMetrics } from "@/server/services/reports";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

const clinic: ClinicModel = {
  id: "clinic-1",
  clerkOrgId: "org_1",
  name: "Barbearia Teste",
  slug: "barbearia-teste",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
  subscriptionPlan: "MONTHLY",
  subscriptionExpiresAt: null,
  hasPaidOnce: true,
  mercadoPagoSubscriptionId: null,
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
  const serviceId = overrides.serviceId ?? `svc-${overrides.serviceName ?? "Corte"}`;
  const professionalId = overrides.professionalName ? (overrides.professionalId ?? `prof-${overrides.professionalName}`) : null;

  return {
    id: overrides.id ?? "app-1",
    startTime: overrides.startTime,
    endTime: new Date(overrides.startTime.getTime() + 30 * 60_000),
    status: overrides.status,
    paymentMethod: overrides.paymentMethod ?? "OTHER",
    notes: null,
    clinicId: clinic.id,
    customerId: "cust-1",
    serviceId,
    professionalId,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { name: "Cliente" },
    service: { name: overrides.serviceName ?? "Corte", price: overrides.price },
    professional: overrides.professionalName ? { name: overrides.professionalName } : null,
  };
}

describe("getReportsMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna contagens gerais e taxas do mês", async () => {
    const { startOfMonth } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );

    prismaMock.appointment.count.mockResolvedValueOnce(10);
    prismaMock.customer.count.mockResolvedValueOnce(5);
    prismaMock.service.count.mockResolvedValueOnce(3);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ id: "app-1", status: "CONFIRMED", price: 50, startTime: new Date(startOfMonth.getTime() + 60 * 60_000), serviceName: "Corte" }),
      createAppointment({ id: "app-2", status: "COMPLETED", price: 70, startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000), serviceName: "Barba" }),
      createAppointment({ id: "app-3", status: "NO_SHOW", price: 40, startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000), serviceName: "Corte" }),
      createAppointment({ id: "app-4", status: "CANCELED", price: 30, startTime: new Date(startOfMonth.getTime() + 4 * 60 * 60_000), serviceName: "Barba" }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getReportsMetrics(clinic);

    expect(metrics.totalAppointments).toBe(10);
    expect(metrics.totalCustomers).toBe(5);
    expect(metrics.totalServices).toBe(3);
    expect(metrics.activeCustomersThisMonth).toBe(1);
    expect(metrics.confirmationRate).toBe(50); // 2 confirmados/completados de 4 total
    expect(metrics.noShowRate).toBe(25); // 1 no-show de 4 total
    expect(metrics.monthAppointments).toHaveLength(4);
    expect(metrics.topServices).toHaveLength(2);
    expect(metrics.topServices[0]?.name).toBe("Corte");
    expect(metrics.topServices[0]?.count).toBe(2);
  });

  it("retorna ranking de profissionais do mês", async () => {
    const { startOfMonth } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );

    prismaMock.appointment.count.mockResolvedValueOnce(0);
    prismaMock.customer.count.mockResolvedValueOnce(0);
    prismaMock.service.count.mockResolvedValueOnce(0);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ id: "app-1", status: "CONFIRMED", price: 50, startTime: new Date(startOfMonth.getTime() + 60 * 60_000), professionalName: "João" }),
      createAppointment({ id: "app-2", status: "CONFIRMED", price: 70, startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000), professionalName: "João" }),
      createAppointment({ id: "app-3", status: "CONFIRMED", price: 40, startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000), professionalName: "Pedro" }),
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
