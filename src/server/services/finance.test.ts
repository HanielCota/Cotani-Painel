import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getFinanceMetrics } from "@/server/services/finance";
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
  customerName?: string;
  serviceName?: string;
  professionalName?: string | null;
}) {
  return {
    id: overrides.id ?? "app-1",
    startTime: overrides.startTime,
    endTime: new Date(overrides.startTime.getTime() + 30 * 60_000),
    status: overrides.status,
    notes: null,
    clinicId: clinic.id,
    customerId: "cust-1",
    serviceId: "svc-1",
    professionalId: "prof-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { name: overrides.customerName ?? "Cliente" },
    service: { name: overrides.serviceName ?? "Corte", price: overrides.price },
    professional: overrides.professionalName ? { name: overrides.professionalName } : null,
  };
}

describe("getFinanceMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula receita e contagens do mês atual", async () => {
    const { startOfMonth } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ status: "CONFIRMED", price: 50, startTime: new Date(startOfMonth.getTime() + 60 * 60_000) }),
      createAppointment({ status: "COMPLETED", price: 70, startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000) }),
      createAppointment({ status: "CANCELED", price: 30, startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000) }),
      createAppointment({ status: "NO_SHOW", price: 40, startTime: new Date(startOfMonth.getTime() + 4 * 60 * 60_000) }),
      createAppointment({ status: "PENDING", price: 60, startTime: new Date(startOfMonth.getTime() + 5 * 60 * 60_000) }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getFinanceMetrics(clinic);

    expect(metrics.currentMonthRevenue).toBe(120); // 50 + 70
    expect(metrics.monthAppointmentsTotal).toBe(5);
    expect(metrics.monthConfirmedCount).toBe(1);
    expect(metrics.monthCompletedCount).toBe(1);
    expect(metrics.monthCanceledCount).toBe(1);
    expect(metrics.monthNoShowCount).toBe(1);
    expect(metrics.revenueChangePercent).toBeNull();
  });

  it("calcula variação percentual em relação ao mês anterior", async () => {
    const { startOfMonth, startOfPreviousMonth } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ status: "CONFIRMED", price: 120, startTime: new Date(startOfMonth.getTime() + 60 * 60_000) }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ status: "CONFIRMED", price: 100, startTime: new Date(startOfPreviousMonth.getTime() + 60 * 60_000) }),
    ]);

    const metrics = await getFinanceMetrics(clinic);

    expect(metrics.currentMonthRevenue).toBe(120);
    expect(metrics.previousMonthRevenue).toBe(100);
    expect(metrics.revenueChangePercent).toBe(20);
  });
});
