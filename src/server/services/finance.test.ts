import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getFinanceMetrics } from "@/server/services/finance";
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
  customerName?: string;
  serviceName?: string;
  professionalName?: string | null;
}) {
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
    serviceId: "svc-1",
    professionalId: "prof-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { name: overrides.customerName ?? "Cliente" },
    service: { name: overrides.serviceName ?? "Serviço A", price: overrides.price },
    professional: overrides.professionalName ? { name: overrides.professionalName } : null,
  };
}

describe("getFinanceMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula receita e contagens do mês atual", async () => {
    const { getClinicDateBounds } = await import("@/lib/timezone");
    const { startOfMonth } = getClinicDateBounds(clinic.timeZone);

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({
        status: "CONFIRMED",
        price: 50,
        startTime: new Date(startOfMonth.getTime() + 60 * 60_000),
        paymentMethod: "PIX",
      }),
      createAppointment({
        status: "COMPLETED",
        price: 70,
        startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000),
        paymentMethod: "CREDIT_CARD",
      }),
      createAppointment({
        status: "CANCELED",
        price: 30,
        startTime: new Date(startOfMonth.getTime() + 3 * 60 * 60_000),
      }),
      createAppointment({
        status: "NO_SHOW",
        price: 40,
        startTime: new Date(startOfMonth.getTime() + 4 * 60 * 60_000),
      }),
      createAppointment({
        status: "PENDING",
        price: 60,
        startTime: new Date(startOfMonth.getTime() + 5 * 60 * 60_000),
      }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getFinanceMetrics(clinic);

    expect(metrics.currentMonthRevenue).toBe(70); // receita realizada: apenas concluídos
    expect(metrics.expectedRevenue).toBe(110); // pendentes e confirmados
    expect(metrics.monthAppointmentsTotal).toBe(5);
    expect(metrics.monthPendingCount).toBe(1);
    expect(metrics.monthConfirmedCount).toBe(1);
    expect(metrics.monthCompletedCount).toBe(1);
    expect(metrics.monthCanceledCount).toBe(1);
    expect(metrics.monthNoShowCount).toBe(1);
    expect(metrics.revenueChangePercent).toBeNull();
    expect(metrics.statusDistribution).toHaveLength(5);
    expect(metrics.paymentMethodDistribution).toHaveLength(1);
    expect(metrics.dailyRevenue).toHaveLength(1);
    expect(metrics.monthlyRevenue).toHaveLength(6);
  });

  it("calcula variação percentual em relação ao mês anterior", async () => {
    const { getClinicDateBounds } = await import("@/lib/timezone");
    const { startOfMonth, startOfPreviousMonth } = getClinicDateBounds(clinic.timeZone);

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ status: "COMPLETED", price: 120, startTime: new Date(startOfMonth.getTime() + 60 * 60_000) }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({
        status: "COMPLETED",
        price: 100,
        startTime: new Date(startOfPreviousMonth.getTime() + 60 * 60_000),
      }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getFinanceMetrics(clinic);

    expect(metrics.currentMonthRevenue).toBe(120);
    expect(metrics.previousMonthRevenue).toBe(100);
    expect(metrics.revenueChangePercent).toBe(20);
  });

  it("agrupa receita diária corretamente", async () => {
    const { getClinicDateBounds } = await import("@/lib/timezone");
    const { startOfMonth } = getClinicDateBounds(clinic.timeZone);

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({
        id: "app-1",
        status: "COMPLETED",
        price: 50,
        startTime: new Date(startOfMonth.getTime() + 60 * 60_000),
        paymentMethod: "PIX",
      }),
      createAppointment({
        id: "app-2",
        status: "COMPLETED",
        price: 70,
        startTime: new Date(startOfMonth.getTime() + 2 * 60 * 60_000),
        paymentMethod: "PIX",
      }),
      createAppointment({
        id: "app-3",
        status: "COMPLETED",
        price: 30,
        startTime: new Date(startOfMonth.getTime() + 24 * 60 * 60_000),
        paymentMethod: "CASH",
      }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getFinanceMetrics(clinic);

    expect(metrics.dailyRevenue).toHaveLength(2);
    expect(metrics.dailyRevenue[0]?.value).toBe(120);
    expect(metrics.dailyRevenue[1]?.value).toBe(30);
    expect(metrics.paymentMethodDistribution.find((m) => m.name === "Pix")?.value).toBe(80);
    expect(metrics.paymentMethodDistribution.find((m) => m.name === "Dinheiro")?.value).toBe(20);
  });

  it("mantém os centavos no ticket médio", async () => {
    const { startOfMonth } = await import("@/lib/timezone").then((m) =>
      m.getClinicDateBounds(clinic.timeZone),
    );
    const startTime = new Date(startOfMonth.getTime() + 60 * 60_000);

    prismaMock.appointment.findMany.mockResolvedValueOnce([
      createAppointment({ id: "app-1", status: "COMPLETED", price: 49.99, startTime, paymentMethod: "PIX" }),
      createAppointment({ id: "app-2", status: "COMPLETED", price: 49.99, startTime, paymentMethod: "PIX" }),
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const metrics = await getFinanceMetrics(clinic);

    // Arredondar para reais mostrava R$ 50,00.
    expect(metrics.kpiSeries.ticket.filter((value) => value > 0)).toEqual([49.99]);
  });

  it("aplica o intervalo selecionado também nas consultas financeiras", async () => {
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    await getFinanceMetrics(clinic, "7days");

    const selectedWhere = prismaMock.appointment.findMany.mock.calls[0]?.[0]?.where?.startTime as {
      gte: Date;
      lt: Date;
    };
    const previousWhere = prismaMock.appointment.findMany.mock.calls[1]?.[0]?.where?.startTime as {
      gte: Date;
      lt: Date;
    };
    const selectedDurationInDays = (selectedWhere.lt.getTime() - selectedWhere.gte.getTime()) / (24 * 60 * 60 * 1_000);

    expect(selectedDurationInDays).toBeGreaterThanOrEqual(6.9);
    expect(selectedDurationInDays).toBeLessThanOrEqual(7.1);
    // O período anterior é cortado no mesmo tempo decorrido do atual (parcial vs parcial).
    const elapsed = Math.min(Date.now(), selectedWhere.lt.getTime()) - selectedWhere.gte.getTime();
    expect(previousWhere.lt.getTime()).toBeLessThanOrEqual(selectedWhere.gte.getTime());
    expect(Math.abs(previousWhere.lt.getTime() - previousWhere.gte.getTime() - elapsed)).toBeLessThan(5_000);
  });
});
