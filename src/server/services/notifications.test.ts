import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import {
  deletePendingNotifications,
  enqueueAppointmentNotifications,
} from "@/server/services/notifications";

describe("enqueueAppointmentNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_SENDER_MODE = "manual";
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

  it("enfileira e-mail e SMS sem colisão de idempotência", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    await enqueueAppointmentNotifications(
      prismaMock as unknown as Parameters<typeof enqueueAppointmentNotifications>[0],
      { ...baseParams, customerEmail: "joao@example.com", channels: ["WHATSAPP", "EMAIL", "SMS"] },
    );
    const data = prismaMock.notification.createMany.mock.calls[0][0].data as Array<{
      channel: string;
      idempotencyKey: string;
    }>;
    expect(new Set(data.map((item) => item.channel))).toEqual(new Set(["WHATSAPP", "EMAIL", "SMS"]));
    expect(new Set(data.map((item) => item.idempotencyKey)).size).toBe(data.length);
  });

  it("não promete resposta automática quando o WhatsApp é manual", async () => {
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));

    await enqueueAppointmentNotifications(
      prismaMock as unknown as Parameters<typeof enqueueAppointmentNotifications>[0],
      baseParams,
    );

    const data = prismaMock.notification.createMany.mock.calls[0][0].data as Array<{
      channel: string;
      content: string;
    }>;
    const whatsapp = data.find((item) => item.channel === "WHATSAPP");

    expect(whatsapp?.content).not.toContain("Responda 1");
  });

  it("inclui instruções de resposta quando a automação do WhatsApp está ativa", async () => {
    process.env.WHATSAPP_SENDER_MODE = "api";
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));

    await enqueueAppointmentNotifications(
      prismaMock as unknown as Parameters<typeof enqueueAppointmentNotifications>[0],
      baseParams,
    );

    const data = prismaMock.notification.createMany.mock.calls[0][0].data as Array<{
      channel: string;
      content: string;
    }>;
    const whatsapp = data.find((item) => item.channel === "WHATSAPP");

    expect(whatsapp?.content).toContain("Responda 1");
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
