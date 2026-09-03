import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createAppointmentFromForm,
  updateAppointmentStatus,
} from "@/server/actions/appointments";

vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));

vi.mock("@/server/tenant", () => ({
  getClinicForRoles: vi.fn(),
  getTenantContext: vi.fn(),
}));

vi.mock("@/server/services/scheduling", () => ({
  scheduleAppointment: vi.fn(),
  isDoubleBookingError: vi.fn(),
  DOUBLE_BOOKING_MESSAGE: "Horário indisponível.",
}));

const { getClinicForRoles, getTenantContext } = await import("@/server/tenant");

const activeClinic = {
  id: "clinic-1",
  name: "Loja",
  slug: "loja",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
  subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

describe("updateAppointmentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      clinicId: "clinic-1",
      role: "ADMIN",
      clinic: activeClinic,
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
  });

  it("retorna erro para ID inválido", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);

    const result = await updateAppointmentStatus("invalid", { status: "CONFIRMED" });

    expect(result.status).toBe("error");
  });

  it("retorna erro para transição de status inválida", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "PENDING" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "COMPLETED" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("não é permitida");
  });

  it("atualiza status de PENDING para CONFIRMED", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "PENDING" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "CONFIRMED" });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002", clinicId: "clinic-1", status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
  });

  it("exige método de pagamento ao concluir", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "CONFIRMED" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "COMPLETED" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("método de pagamento");
  });

  it("atualiza status para COMPLETED com método de pagamento", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "CONFIRMED" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", {
      status: "COMPLETED",
      paymentMethod: "PIX",
    });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002", clinicId: "clinic-1", status: "CONFIRMED" },
      data: expect.objectContaining({ status: "COMPLETED", paymentMethod: "PIX", paidAt: expect.any(Date) }),
    });
  });

  it("rejeita uma atualização concorrente do mesmo atendimento", async () => {
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "PENDING" });
    prismaMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "CONFIRMED" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("outra operação");
  });
});

describe("createAppointmentFromForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna erro para horário passado", async () => {
    vi.setSystemTime(new Date("2026-07-21T10:00:00.000Z"));
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);

    const formData = new FormData();
    formData.set("startTime", "2026-07-20T14:00");

    const result = await createAppointmentFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("horário futuro");
  });
});
