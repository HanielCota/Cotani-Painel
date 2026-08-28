import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { saveBusinessHours, saveBusinessHoursFromForm } from "@/server/actions/business-hours";

vi.mock("@/server/auth", () => ({ requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));

vi.mock("@/server/tenant", () => ({
  getClinicForRoles: vi.fn(),
}));

const { getClinicForRoles } = await import("@/server/tenant");

const activeClinic = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Barbearia",
  slug: "barbearia",
  timeZone: "America/Sao_Paulo",
  subscriptionStatus: "ACTIVE",
  subscriptionExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

function createValidHours() {
  return [
    { dayOfWeek: 0, isOpen: false, openTime: "08:00", closeTime: "18:00", breakStart: "", breakEnd: "" },
    { dayOfWeek: 1, isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    { dayOfWeek: 2, isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    { dayOfWeek: 3, isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    { dayOfWeek: 4, isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    { dayOfWeek: 5, isOpen: true, openTime: "08:00", closeTime: "18:00", breakStart: "12:00", breakEnd: "13:00" },
    { dayOfWeek: 6, isOpen: true, openTime: "08:00", closeTime: "14:00", breakStart: "", breakEnd: "" },
  ];
}

describe("saveBusinessHours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValue(activeClinic);
    prismaMock.$transaction.mockImplementation(async (items: Array<Promise<unknown>>) =>
      Promise.all(items),
    );
  });

  it("retorna erro para dados inválidos", async () => {
    const result = await saveBusinessHours([{ dayOfWeek: 1, isOpen: true, openTime: "invalid", closeTime: "18:00" }]);

    expect(result.status).toBe("error");
  });

  it("retorna erro quando não há barbearia", async () => {
    (getClinicForRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await saveBusinessHours(createValidHours());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Selecione uma barbearia");
  });

  it("retorna erro quando abertura é após fechamento", async () => {
    const hours = createValidHours();
    hours[1].openTime = "19:00";

    const result = await saveBusinessHours(hours);

    expect(result.status).toBe("error");
    expect(result.message).toContain("abertura deve ser anterior");
  });

  it("retorna erro quando intervalo está fora do expediente", async () => {
    const hours = createValidHours();
    hours[1].breakStart = "19:00";
    hours[1].breakEnd = "20:00";

    const result = await saveBusinessHours(hours);

    expect(result.status).toBe("error");
    expect(result.message).toContain("intervalo deve estar dentro");
  });

  it("salva expediente com sucesso", async () => {
    const result = await saveBusinessHours(createValidHours());

    expect(result.status).toBe("success");
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.businessHour.upsert).toHaveBeenCalledTimes(7);
  });

  it("processa FormData corretamente", async () => {

    const formData = new FormData();
    for (let day = 0; day <= 6; day += 1) {
      formData.set(`openTime-${day}`, "09:00");
      formData.set(`closeTime-${day}`, "17:00");
      formData.set(`breakStart-${day}`, "12:00");
      formData.set(`breakEnd-${day}`, "13:00");
      if (day !== 0) {
        formData.set(`isOpen-${day}`, "on");
      }
    }

    const result = await saveBusinessHoursFromForm({ status: "success", message: "" }, formData);

    expect(result.status).toBe("success");
  });
});
