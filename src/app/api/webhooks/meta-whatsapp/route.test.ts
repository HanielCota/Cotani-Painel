import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  appointment: { updateMany: vi.fn() },
  webhookEvent: { create: vi.fn() },
};
const prismaMock = {
  webhookEvent: { findUnique: vi.fn() },
  notification: { findFirst: vi.fn() },
  appointment: { findFirst: vi.fn() },
  $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
};

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/server/services/messaging/message-sender", () => ({
  getMessageSender: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ ok: true }) })),
}));

const { GET, POST } = await import("@/app/api/webhooks/meta-whatsapp/route");

describe("webhook Meta WhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("META_WHATSAPP_VERIFY_TOKEN", "verify-token");
    vi.stubEnv("META_APP_SECRET", "");
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null);
  });

  it("responde ao desafio de verificação", async () => {
    const request = new NextRequest("https://painel.cotani.com.br/api/webhooks/meta-whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=12345");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("confirma o próximo atendimento pendente quando o cliente responde 1", async () => {
    prismaMock.notification.findFirst.mockResolvedValueOnce({
      appointmentId: "appointment-1",
      appointment: {
        id: "appointment-1",
        cancellationToken: "cancel-token",
        clinic: { name: "Barbearia", slug: "barbearia" },
      },
    });
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ id: "wamid-1", from: "5511999999999", type: "text", text: { body: "1" } }] } }] }],
    };
    const request = new NextRequest("https://painel.cotani.com.br/api/webhooks/meta-whatsapp", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: "appointment-1", status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
    expect(tx.webhookEvent.create).toHaveBeenCalled();
  });
});
