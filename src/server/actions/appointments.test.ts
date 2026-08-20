import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  createAppointmentFromForm,
  updateAppointmentStatus,
} from "@/server/actions/appointments";

vi.mock("@clerk/nextjs/server", () => {
  const protect = vi.fn();
  return {
    auth: Object.assign(vi.fn(() => ({ protect })), { protect }),
  };
});

vi.mock("@/server/tenant", () => ({
  requireActiveClinic: vi.fn(),
}));

vi.mock("@/server/services/scheduling", () => ({
  scheduleAppointment: vi.fn(),
  isDoubleBookingError: vi.fn(),
  DOUBLE_BOOKING_MESSAGE: "Horário indisponível.",
}));

const { auth } = await import("@clerk/nextjs/server");
const { requireActiveClinic } = await import("@/server/tenant");

(auth.protect as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1", orgId: "org-1" });

const activeClinic = {
  id: "clinic-1",
  name: "Barbearia",
  slug: "barbearia",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
};

describe("updateAppointmentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna erro para ID inválido", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);

    const result = await updateAppointmentStatus("invalid", { status: "CONFIRMED" });

    expect(result.status).toBe("error");
  });

  it("retorna erro para transição de status inválida", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "PENDING" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "COMPLETED" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("não é permitida");
  });

  it("atualiza status de PENDING para CONFIRMED", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "PENDING" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "CONFIRMED" });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002" },
      data: { status: "CONFIRMED" },
    });
  });

  it("exige método de pagamento ao concluir", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "CONFIRMED" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", { status: "COMPLETED" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("método de pagamento");
  });

  it("atualiza status para COMPLETED com método de pagamento", async () => {
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "550e8400-e29b-41d4-a716-446655440002", status: "CONFIRMED" });

    const result = await updateAppointmentStatus("550e8400-e29b-41d4-a716-446655440002", {
      status: "COMPLETED",
      paymentMethod: "PIX",
    });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.update).toHaveBeenCalledWith({
      where: { id: "550e8400-e29b-41d4-a716-446655440002" },
      data: { status: "COMPLETED", paymentMethod: "PIX" },
    });
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
    (requireActiveClinic as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeClinic);

    const formData = new FormData();
    formData.set("startTime", "2026-07-20T14:00");

    const result = await createAppointmentFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("error");
    expect(result.message).toContain("horário futuro");
  });
});
