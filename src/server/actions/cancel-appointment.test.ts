import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { cancelAppointmentByToken } from "@/server/actions/cancel-appointment";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

const TOKEN = "11111111-1111-4111-8111-111111111111";

describe("cancelAppointmentByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, limit: 10, remaining: 9, resetAt: new Date() });
    prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna erro para input inválido", async () => {
    const result = await cancelAppointmentByToken({ slug: "", token: "" });

    expect(result.status).toBe("error");
  });

  it("retorna erro quando loja não existe", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce(null);

    const result = await cancelAppointmentByToken({ slug: "inexistente", token: TOKEN });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Negócio não encontrado");
  });

  it("retorna erro quando agendamento não existe", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce(null);

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("error");
  });

  it("retorna sucesso quando já está cancelado", async () => {
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CANCELED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("success");
  });

  it("retorna erro para agendamento passado", async () => {
    vi.setSystemTime(new Date("2026-07-21T10:00:00.000Z"));
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CONFIRMED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("error");
  });

  it("cancela agendamento futuro com sucesso", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CONFIRMED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => {
      return callback(prismaMock);
    });

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("success");
    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "app-1",
        clinicId: "clinic-1",
        status: "CONFIRMED",
        startTime: { gt: expect.any(Date) },
      },
      data: { status: "CANCELED" },
    });
  });

  it("não sobrescreve uma alteração concorrente", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    prismaMock.clinic.findFirst.mockResolvedValueOnce({ id: "clinic-1" });
    prismaMock.appointment.findFirst.mockResolvedValueOnce({
      id: "app-1",
      status: "CONFIRMED",
      startTime: new Date("2026-07-20T14:00:00.000Z"),
    });
    prismaMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock));

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("error");
    expect(result.message).toContain("alterado");
  });

  it("bloqueia excesso de tentativas antes de consultar o agendamento", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, limit: 10, remaining: 0, resetAt: new Date() });

    const result = await cancelAppointmentByToken({ slug: "loja", token: TOKEN });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Muitas tentativas");
    expect(prismaMock.clinic.findFirst).not.toHaveBeenCalled();
  });
});
