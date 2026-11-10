import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { createPublicAppointment } from "@/server/actions/public-booking";

vi.mock("@/server/services/scheduling", () => ({
  scheduleAppointment: vi.fn(),
  rescheduleScheduledAppointment: vi.fn(),
  DOUBLE_BOOKING_MESSAGE: "Horário indisponível. Por favor, escolha outro.",
}));

const { scheduleAppointment, rescheduleScheduledAppointment } = await import("@/server/services/scheduling");

describe("createPublicAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    prismaMock.rateLimit.upsert.mockResolvedValue({ count: 1, id: "rl-1", key: "key", windowStart: new Date(), resetAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createFormData(overrides: Record<string, string> = {}) {
    const formData = new FormData();
    formData.set("slug", "loja-teste");
    formData.set("serviceId", "550e8400-e29b-41d4-a716-446655440001");
    formData.set("customerName", "João Silva");
    formData.set("customerPhone", "11999999999");
    formData.set("startTime", "2026-07-20T14:00:00.000Z");
    Object.entries(overrides).forEach(([key, value]) => formData.set(key, value));
    return formData;
  }

  it("retorna erro quando rate limit é excedido", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValueOnce({
      count: 6,
      id: "rl-1",
      key: "key",
      windowStart: new Date(),
      resetAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Muitas tentativas");
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await createPublicAppointment({ status: "success", message: "" }, new FormData());

    expect(result.status).toBe("error");
  });

  it("retorna erro quando loja não existe", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce(null);

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Negócio não encontrado");
  });

  it("retorna erro quando assinatura não está ativa", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "loja-teste",
      name: "Loja",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "INACTIVE",
      operationalStatus: "ACTIVE",
      deletedAt: null,
    });

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
  });

  it("retorna erro quando serviço está indisponível", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "loja-teste",
      name: "Loja",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      operationalStatus: "ACTIVE",
      deletedAt: null,
    });
    prismaMock.service.findFirst.mockResolvedValueOnce(null);

    const result = await createPublicAppointment({ status: "success", message: "" }, createFormData());

    expect(result.status).toBe("error");
  });

  it("cria agendamento com sucesso", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    prismaMock.clinic.findFirst.mockResolvedValueOnce({
      id: "clinic-1",
      slug: "loja-teste",
      name: "Loja",
      timeZone: "America/Sao_Paulo",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      operationalStatus: "ACTIVE",
      deletedAt: null,
    });
    prismaMock.service.findFirst.mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Serviço A",
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

  describe("reagendamento pelo link público", () => {
    const rescheduleToken = "550e8400-e29b-41d4-a716-446655440099";

    function arrangeClinicAndService() {
      vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
      prismaMock.clinic.findFirst.mockResolvedValueOnce({
        id: "clinic-1", slug: "loja-teste", name: "Loja", timeZone: "America/Sao_Paulo",
        subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"), operationalStatus: "ACTIVE", deletedAt: null,
      });
      prismaMock.service.findFirst.mockResolvedValueOnce({
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Serviço A",
        duration: 30,
        price: 50,
      });
    }

    it("recusa link de reagendamento inválido sem tentar reservar", async () => {
      arrangeClinicAndService();
      prismaMock.appointment.findFirst.mockResolvedValueOnce(null);

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ rescheduleToken }));

      expect(result).toEqual({ status: "error", message: "Este link de reagendamento não é mais válido." });
      expect(vi.mocked(rescheduleScheduledAppointment)).not.toHaveBeenCalled();
      expect(vi.mocked(scheduleAppointment)).not.toHaveBeenCalled();
    });

    it("reagenda o atendimento existente mantendo cliente e token", async () => {
      arrangeClinicAndService();
      prismaMock.appointment.findFirst.mockResolvedValueOnce({
        id: "app-existing",
        customerId: "cust-1",
        cancellationToken: rescheduleToken,
        customer: { name: "João Silva", phone: "5511999999999", email: null },
      });
      vi.mocked(rescheduleScheduledAppointment).mockResolvedValueOnce({ status: "success" });

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ rescheduleToken }));

      expect(result).toEqual({ status: "success", message: "Agendamento reagendado.", professionalName: undefined });
      expect(vi.mocked(rescheduleScheduledAppointment).mock.calls[0][0]).toMatchObject({
        appointmentId: "app-existing",
        customerId: "cust-1",
        cancellationToken: rescheduleToken,
        professionalId: null,
      });
      expect(vi.mocked(scheduleAppointment)).not.toHaveBeenCalled();
    });
  });

  describe("sem preferência de profissional", () => {
    const serviceId = "550e8400-e29b-41d4-a716-446655440001";

    function arrangeClinic() {
      vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
      prismaMock.clinic.findFirst.mockResolvedValueOnce({
        id: "clinic-1", slug: "loja-teste", name: "Loja", timeZone: "America/Sao_Paulo",
        subscriptionStatus: "ACTIVE", subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"), operationalStatus: "ACTIVE", deletedAt: null,
      });
      prismaMock.service.findFirst.mockResolvedValueOnce({ id: serviceId, name: "Serviço A", duration: 30, price: 50 });
      // Candidatos em ordem alfabética; Bia já tem 2 atendimentos no dia, Caio nenhum.
      prismaMock.professional.findMany.mockResolvedValueOnce([{ id: "prof-bia" }, { id: "prof-caio" }]);
      prismaMock.appointment.findMany.mockResolvedValueOnce([{ professionalId: "prof-bia" }, { professionalId: "prof-bia" }]);
    }

    it("tenta primeiro o profissional menos ocupado e informa quem vai atender", async () => {
      arrangeClinic();
      prismaMock.professional.findFirst.mockResolvedValueOnce({ name: "Caio" });
      vi.mocked(scheduleAppointment).mockResolvedValueOnce({ status: "success", appointmentId: "app-1", cancellationToken: "t" });

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ professionalId: "any" }));

      expect(result).toMatchObject({ status: "success", professionalName: "Caio" });
      expect(vi.mocked(scheduleAppointment)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(scheduleAppointment).mock.calls[0][0].professionalId).toBe("prof-caio");
    });

    it("em conflito, passa para o próximo candidato", async () => {
      arrangeClinic();
      prismaMock.professional.findFirst.mockResolvedValueOnce({ name: "Bia" });
      vi.mocked(scheduleAppointment)
        .mockResolvedValueOnce({ status: "conflict" })
        .mockResolvedValueOnce({ status: "success", appointmentId: "app-1", cancellationToken: "t" });

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ professionalId: "any" }));

      expect(result).toMatchObject({ status: "success", professionalName: "Bia" });
      expect(vi.mocked(scheduleAppointment).mock.calls.map(([params]) => params.professionalId)).toEqual(["prof-caio", "prof-bia"]);
    });

    it("sem nenhum candidato livre, devolve horário indisponível", async () => {
      arrangeClinic();
      vi.mocked(scheduleAppointment).mockResolvedValue({ status: "conflict" });

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ professionalId: "any" }));

      expect(result).toEqual({ status: "error", message: "Horário indisponível. Por favor, escolha outro." });
      expect(vi.mocked(scheduleAppointment)).toHaveBeenCalledTimes(2);
    });

    it("erro inesperado interrompe as tentativas", async () => {
      arrangeClinic();
      vi.mocked(scheduleAppointment).mockResolvedValueOnce({ status: "error" });

      const result = await createPublicAppointment({ status: "success", message: "" }, createFormData({ professionalId: "any" }));

      expect(result.status).toBe("error");
      expect(vi.mocked(scheduleAppointment)).toHaveBeenCalledTimes(1);
    });
  });
});
