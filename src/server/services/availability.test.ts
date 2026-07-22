import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { getAvailableDatesInMonth, getAvailableSlots } from "@/server/services/availability";

const clinicId = "clinic-1";
const timeZone = "America/Sao_Paulo";

describe("getAvailableSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna null para data inválida", async () => {
    const result = await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 30,
      date: "invalid",
    });

    expect(result).toBeNull();
  });

  it("retorna lista vazia quando barbearia está fechada", async () => {
    vi.setSystemTime(new Date("2026-07-20T10:00:00.000Z"));

    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      id: "bh-1",
      clinicId,
      dayOfWeek: 1,
      isOpen: false,
      openTime: "09:00",
      closeTime: "18:00",
      breakStart: null,
      breakEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const result = await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 30,
      date: "2026-07-20",
    });

    expect(result).toEqual([]);
  });

  it("retorna slots dentro do expediente", async () => {
    vi.setSystemTime(new Date("2026-07-20T06:00:00.000Z"));

    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      id: "bh-1",
      clinicId,
      dayOfWeek: 1,
      isOpen: true,
      openTime: "09:00",
      closeTime: "12:00",
      breakStart: null,
      breakEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const result = await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 30,
      date: "2026-07-20",
    });

    expect(result).toHaveLength(6); // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30
    expect(result?.[0].label).toBe("09:00");
    expect(result?.[result.length - 1].label).toBe("11:30");
  });

  it("remove slots que cruzam o intervalo de almoço", async () => {
    vi.setSystemTime(new Date("2026-07-20T06:00:00.000Z"));

    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      id: "bh-1",
      clinicId,
      dayOfWeek: 1,
      isOpen: true,
      openTime: "09:00",
      closeTime: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const result = await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 60,
      date: "2026-07-20",
    });

    const labels = result?.map((slot) => slot.label) ?? [];
    expect(labels).not.toContain("11:30");
    expect(labels).not.toContain("12:00");
    expect(labels).toContain("10:00");
    expect(labels).toContain("13:00");
  });

  it("remove slots ocupados por agendamentos existentes", async () => {
    vi.setSystemTime(new Date("2026-07-20T06:00:00.000Z"));

    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      id: "bh-1",
      clinicId,
      dayOfWeek: 1,
      isOpen: true,
      openTime: "09:00",
      closeTime: "12:00",
      breakStart: null,
      breakEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 10:00-10:30 no fuso de SP equivale a 13:00-13:30 UTC no horário de inverno.
    const occupiedStart = new Date("2026-07-20T13:00:00.000Z");
    const occupiedEnd = new Date("2026-07-20T13:30:00.000Z");
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      { startTime: occupiedStart, endTime: occupiedEnd },
    ]);

    const result = await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 30,
      date: "2026-07-20",
    });

    const labels = result?.map((slot) => slot.label) ?? [];
    expect(labels).not.toContain("10:00");
    expect(labels).toContain("09:00");
    expect(labels).toContain("11:30");
  });

  it("filtra por profissional quando professionalId é informado", async () => {
    vi.setSystemTime(new Date("2026-07-20T06:00:00.000Z"));

    prismaMock.businessHour.findUnique.mockResolvedValueOnce({
      id: "bh-1",
      clinicId,
      dayOfWeek: 1,
      isOpen: true,
      openTime: "09:00",
      closeTime: "12:00",
      breakStart: null,
      breakEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    await getAvailableSlots({
      clinicId,
      timeZone,
      serviceDuration: 30,
      date: "2026-07-20",
      professionalId: "prof-1",
    });

    const query = prismaMock.appointment.findMany.mock.calls[0][0] as {
      where: { professionalId?: string };
    };
    expect(query.where.professionalId).toBe("prof-1");
  });
});

describe("getAvailableDatesInMonth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna lista vazia para mês inválido", async () => {
    const result = await getAvailableDatesInMonth({
      clinicId,
      timeZone,
      serviceDuration: 30,
      yearMonth: "invalid",
    });

    expect(result).toEqual([]);
  });

  it("retorna apenas dias com expediente aberto e slots livres", async () => {
    vi.setSystemTime(new Date("2026-07-01T06:00:00.000Z"));

    prismaMock.businessHour.findMany.mockResolvedValueOnce([
      {
        id: "bh-1",
        clinicId,
        dayOfWeek: 1, // segunda
        isOpen: true,
        openTime: "09:00",
        closeTime: "12:00",
        breakStart: null,
        breakEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.appointment.findMany.mockResolvedValueOnce([]);

    const result = await getAvailableDatesInMonth({
      clinicId,
      timeZone,
      serviceDuration: 30,
      yearMonth: "2026-07",
    });

    expect(result).toContain("2026-07-20");
    expect(result).not.toContain("2026-07-19"); // domingo
  });

  it("ignora dias ocupados por agendamentos", async () => {
    vi.setSystemTime(new Date("2026-07-20T06:00:00.000Z"));

    prismaMock.businessHour.findMany.mockResolvedValueOnce([
      {
        id: "bh-1",
        clinicId,
        dayOfWeek: 1,
        isOpen: true,
        openTime: "09:00",
        closeTime: "12:00",
        breakStart: null,
        breakEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // 09:00-12:00 ocupado no fuso SP -> 12:00-15:00 UTC no horário de inverno.
    prismaMock.appointment.findMany.mockResolvedValueOnce([
      { startTime: new Date("2026-07-20T12:00:00.000Z"), endTime: new Date("2026-07-20T15:00:00.000Z") },
    ]);

    const result = await getAvailableDatesInMonth({
      clinicId,
      timeZone,
      serviceDuration: 30,
      yearMonth: "2026-07",
    });

    expect(result).not.toContain("2026-07-20");
  });
});
