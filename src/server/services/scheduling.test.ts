import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { isDoubleBookingError, scheduleAppointment } from "@/server/services/scheduling";

describe("isDoubleBookingError", () => {
  it("retorna true quando encontra SQLSTATE 23P01 na cadeia de erro", () => {
    const error = new Error("conflict");
    (error as { cause?: unknown }).cause = { code: "23P01" };

    expect(isDoubleBookingError(error)).toBe(true);
  });

  it("retorna false quando não há 23P01", () => {
    const error = new Error("generic");

    expect(isDoubleBookingError(error)).toBe(false);
  });

  it("retorna false para erro nulo", () => {
    expect(isDoubleBookingError(null)).toBe(false);
  });
});

describe("scheduleAppointment", () => {
  // Trava do dia devolve `locked`; serviço e profissional, `isActive` (ativos por padrão).
  let inactive: "Service" | "Professional" | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    inactive = null;
    prismaMock.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      const query = Array.from(sql).join("");
      if (query.includes("FOR SHARE")) return [{ isActive: !query.includes(`"${inactive}"`) }];
      return [{ locked: false }];
    });
  });

  const baseParams = {
    clinicId: "clinic-1",
    clinicSlug: "loja-teste",
    clinicName: "Loja Teste",
    timeZone: "America/Sao_Paulo",
    customerId: "cust-1",
    customerName: "João",
    customerPhone: "11999999999",
    serviceId: "svc-1",
    serviceName: "Serviço A",
    serviceDuration: 30,
    servicePrice: 50,
    startTime: new Date("2099-07-20T14:00:00.000Z"),
  };

  it("cria agendamento quando não há conflito", async () => {
    const created = {
      id: "app-1",
      cancellationToken: "token-1",
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      return callback(prismaMock);
    });
    prismaMock.appointment.findFirst.mockResolvedValueOnce(null);
    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      isOpen: true,
      openTime: "08:00",
      closeTime: "18:00",
      breakStart: null,
      breakEnd: null,
    });
    prismaMock.appointment.create.mockResolvedValueOnce(created);
    prismaMock.notification.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await scheduleAppointment(baseParams);

    expect(result.status).toBe("success");
    expect(result).toMatchObject({ appointmentId: "app-1", cancellationToken: "token-1" });
    const [lockQuery] = prismaMock.$queryRaw.mock.calls[0] ?? [];
    expect(Array.from(lockQuery as TemplateStringsArray).join("")).toContain("IS NULL AS locked");
  });

  it("retorna conflict quando há agendamento sobreposto", async () => {
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      return callback(prismaMock);
    });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "app-existing" });
    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      isOpen: true,
      openTime: "08:00",
      closeTime: "18:00",
      breakStart: null,
      breakEnd: null,
    });

    const result = await scheduleAppointment(baseParams);

    expect(result.status).toBe("conflict");
  });

  it("retorna conflict quando a exclusion constraint dispara", async () => {
    const error = new Error("constraint");
    (error as { cause?: unknown }).cause = { code: "23P01" };

    prismaMock.$transaction.mockRejectedValueOnce(error);

    const result = await scheduleAppointment(baseParams);

    expect(result.status).toBe("conflict");
  });

  it.each(["Service", "Professional"] as const)("recusa quando %s foi desativado durante a reserva", async (table) => {
    inactive = table;
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));
    // Horário válido em tudo o mais: só a desativação pode recusar.
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.businessHour.findUnique.mockResolvedValueOnce({ isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: null, breakEnd: null });
    prismaMock.professionalAvailability.findUnique.mockResolvedValueOnce(null);
    prismaMock.appointment.create.mockResolvedValueOnce({ id: "app-1", cancellationToken: "token-1" });
    prismaMock.notification.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await scheduleAppointment({ ...baseParams, professionalId: "550e8400-e29b-41d4-a716-446655440099" });

    expect(result.status).toBe("conflict");
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("retorna error para falhas inesperadas", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("database down"));

    const result = await scheduleAppointment(baseParams);

    expect(result.status).toBe("error");
  });
});
