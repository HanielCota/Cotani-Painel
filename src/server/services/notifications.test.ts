import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  deletePendingNotifications,
  enqueueAppointmentNotifications,
} from "@/server/services/notifications";

describe("enqueueAppointmentNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    appointmentId: "app-1",
    clinicId: "clinic-1",
    clinicSlug: "barbearia-teste",
    clinicName: "Barbearia Teste",
    timeZone: "America/Sao_Paulo",
    customerName: "João",
    customerPhone: "11999999999",
    serviceName: "Corte",
    startTime: new Date("2026-07-20T14:00:00.000Z"),
    cancellationToken: "token-1",
  };

  it("cria notificação de confirmação imediata", async () => {
    vi.setSystemTime(new Date("2026-07-19T14:00:00.000Z"));

    await enqueueAppointmentNotifications(prismaMock as unknown as Parameters<typeof enqueueAppointmentNotifications>[0], baseParams);

    const data = prismaMock.notification.createMany.mock.calls[0][0].data as Array<{
      kind: string;
      content: string;
    }>;

    expect(data.some((item) => item.kind === "CONFIRMATION")).toBe(true);
    expect(data[0].content).toContain("Barbearia Teste");
    expect(data[0].content).toContain("Corte");
  });

  it("cria lembretes 24h e 2h quando o horário está no futuro", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));

    await enqueueAppointmentNotifications(prismaMock as unknown as Parameters<typeof enqueueAppointmentNotifications>[0], baseParams);

    const data = prismaMock.notification.createMany.mock.calls[0][0].data as Array<{
      kind: string;
    }>;

    expect(data.some((item) => item.kind === "REMINDER_24H")).toBe(true);
    expect(data.some((item) => item.kind === "REMINDER_2H")).toBe(true);
  });
});

describe("deletePendingNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("remove notificações pendentes não travadas", async () => {
    vi.setSystemTime(new Date("2026-07-20T10:00:00.000Z"));

    await deletePendingNotifications(prismaMock as unknown as Parameters<typeof deletePendingNotifications>[0], "app-1");

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        appointmentId: "app-1",
        status: "PENDING",
        OR: [{ lockedAt: null }, { lockedAt: { lt: expect.any(Date) } }],
      },
    });
  });
});
