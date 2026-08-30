import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { cancelAppointmentByToken } from "@/server/actions/cancel-appointment";

describe("cancelAppointmentByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna erro para input inválido", async () => {
    const result = await cancelAppointmentByToken({ slug: "", token: "" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando loja não existe", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce(null);

    const result = await cancelAppointmentByToken({ slug: "inexistente", token: "token-1" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Loja não encontrada");
  });

  it("retorna erro quando agendamento não existe", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce(null);

    const result = await cancelAppointmentByToken({ slug: "loja", token: "token-1" });

    expect(result.status).toBe("error");
  });

  it("retorna sucesso quando já está cancelado", async () => {
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CANCELED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: "token-1" });

    expect(result.status).toBe("success");
  });

  it("retorna erro para agendamento passado", async () => {
    vi.setSystemTime(new Date("2026-07-21T10:00:00.000Z"));
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CONFIRMED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: "token-1" });

    expect(result.status).toBe("error");
  });

  it("cancela agendamento futuro com sucesso", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    prismaMock.clinic.findUnique.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CONFIRMED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      return callback(prismaMock);
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: "token-1" });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { status: "CANCELED" },
    });
  });
});
