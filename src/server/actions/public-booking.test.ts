import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { createPublicAppointment } from "@/server/actions/public-booking";

vi.mock("@/server/services/scheduling", () => ({
  scheduleAppointment: vi.fn(),
  DOUBLE_BOOKING_MESSAGE: "Horário indisponível. Por favor, escolha outro.",
}));

const { scheduleAppointment } = await import("@/server/services/scheduling");

describe("createPublicAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createFormData(overrides: Record<string, string> = {}) {
    const formData = new FormData();
    formData.set("slug", "barbearia-teste");
    formData.set("serviceId", "550e8400-e29b-41d4-a716-446655440001");
    formData.set("customerName", "João Silva");
    formData.set("customerPhone", "11999999999");
    formData.set("startTime", "2026-07-20T14:00:00.000Z");
    Object.entries(overrides).forEach(([key, value]) => formData.set(key, value));
    return formData;
  }

  it("retorna erro para dados inválidos", async () => {
    const result = await createPublicAppointment({ status: "success", message: "" }, new FormData());

    expect(result.status).toBe("error");
  });

  it("retorna erro quando barbearia não existe", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce(null);

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Barbearia não encontrada");
  });

  it("retorna erro quando assinatura não está ativa", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "barbearia-teste",
      name: "Barbearia",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "INACTIVE",
    });

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
  });

  it("retorna erro quando serviço está indisponível", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "barbearia-teste",
      name: "Barbearia",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "ACTIVE",
    });
    prismaMock.service.findFirst.mockResolvedValueOnce(null);

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
  });

  it("cria agendamento com sucesso", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    prismaMock.clinic.findUnique.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "barbearia-teste",
      name: "Barbearia",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "ACTIVE",
    });
    prismaMock.service.findFirst.mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Corte",
      duration: 30,
    });
    prismaMock.customer.upsert.mockResolvedValueOnce({
      id: "cust-1",
      name: "João Silva",
      phone: "11999999999",
    });
    (scheduleAppointment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: "success",
      appointmentId: "app-1",
      cancellationToken: "token-1",
    });

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("success");
  });
});
