import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getDashboardMetrics } from "@/server/services/metrics";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

const clinic: ClinicModel = {
  id: "clinic-1",
  legacyExternalId: "org_1",
  billingOwnerId: null,
  name: "Loja Teste",
  slug: "loja-teste",
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

describe("getDashboardMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula métricas corretamente quando há agendamentos", async () => {
    const today = new Date();
    const { startOfToday } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone, today),
    );

    prismaMock.appointment.count.mockResolvedValueOnce(100); // totalAppointments
    prismaMock.appointment.count.mockResolvedValueOnce(5); // confirmedToday
    prismaMock.appointment.count.mockResolvedValueOnce(2); // noShowsThisMonth
    prismaMock.customer.count.mockResolvedValueOnce(50); // totalCustomers
    prismaMock.service.count.mockResolvedValueOnce(8); // totalServices
    prismaMock.appointment.count.mockResolvedValueOnce(40); // monthAppointmentsTotal
    prismaMock.appointment.count.mockResolvedValueOnce(35); // confirmedOrCompletedThisMonth
    prismaMock.appointment.count.mockResolvedValueOnce(32); // previousMonthAppointmentsTotal
    prismaMock.appointment.count.mockResolvedValueOnce(3); // cancellationsThisMonth
    prismaMock.customer.count.mockResolvedValueOnce(4); // newCustomersThisMonth
    prismaMock.appointment.aggregate
      .mockResolvedValueOnce({ _sum: { totalPrice: 1_200 } })
      .mockResolvedValueOnce({ _sum: { totalPrice: 900 } });
    prismaMock.appointment.findMany.mockResolvedValueOnce([{ customerId: "cust-1" }, { customerId: "cust-2" }]); // activeCustomers
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      {
        id: "app-1",
        customerId: "cust-1",
        totalPrice: 50,
        service: { price: 50 },
        startTime: startOfToday,
        endTime: startOfToday,
      },
      {
        id: "app-2",
        customerId: "cust-2",
        totalPrice: 70,
        service: { price: 70 },
        startTime: startOfToday,
        endTime: startOfToday,
      },
    ]); // todayAppointments

    const metrics = await getDashboardMetrics(clinic);

    expect(metrics.totalAppointments).toBe(100);
    expect(metrics.confirmedToday).toBe(5);
    expect(metrics.noShowsThisMonth).toBe(2);
    expect(metrics.totalCustomers).toBe(50);
    expect(metrics.totalServices).toBe(8);
    expect(metrics.activeCustomersThisMonth).toBe(2);
    expect(metrics.confirmationRate).toBe(88); // 35/40 * 100 arredondado
    expect(metrics.noShowRate).toBe(5); // 2/40 * 100 arredondado
    expect(metrics.appointmentsToday).toBe(2);
    expect(metrics.estimatedRevenueToday).toBe(120);
    expect(metrics.customersServedToday).toBe(2);
    expect(metrics.appointmentsThisMonth).toBe(40);
    expect(metrics.appointmentsPreviousMonth).toBe(32);
    expect(metrics.completedRevenueThisMonth).toBe(1_200);
    expect(metrics.completedRevenuePreviousMonth).toBe(900);
    expect(metrics.cancellationsThisMonth).toBe(3);
    expect(metrics.newCustomersThisMonth).toBe(4);
  });

  it("retorna zero quando não há agendamentos no mês", async () => {
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.customer.count.mockResolvedValue(0);
    prismaMock.service.count.mockResolvedValue(0);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.appointment.aggregate.mockResolvedValue({ _sum: { totalPrice: null } });

    const metrics = await getDashboardMetrics(clinic);

    expect(metrics.confirmationRate).toBe(0);
    expect(metrics.noShowRate).toBe(0);
    expect(metrics.appointmentsToday).toBe(0);
    expect(metrics.estimatedRevenueToday).toBe(0);
    expect(metrics.customersServedToday).toBe(0);
    expect(metrics.completedRevenueThisMonth).toBe(0);
  });
});
