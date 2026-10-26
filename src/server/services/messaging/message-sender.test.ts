import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleMessageSender, getMessageSender } from "./message-sender";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("envio de e-mail da fila", () => {
  it("reutiliza a chave da notificação para evitar duplicação em uma tentativa repetida", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "Cotani <contato@cotani.com.br>");
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", send);

    const result = await getMessageSender("EMAIL").send({
      channel: "EMAIL",
      recipient: "cliente@example.com",
      content: "Seu agendamento foi confirmado.",
      notificationKind: "CONFIRMATION",
      idempotencyKey: "appointment-1:CONFIRMATION:EMAIL:2026-10-04T12:00:00.000Z",
    });

    expect(result).toEqual({ ok: true, providerRef: "email-1" });
    expect(send).toHaveBeenCalledOnce();
    const [, options] = send.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "Idempotency-Key": "appointment-1:CONFIRMATION:EMAIL:2026-10-04T12:00:00.000Z",
    });
  });
});

describe("envio simulado", () => {
  it("não grava telefone nem texto da mensagem no log", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await new ConsoleMessageSender().send({
      channel: "WHATSAPP",
      recipient: "5511988887777",
      content: "Olá Maria, seu horário é amanhã.",
      notificationKind: "CONFIRMATION",
      idempotencyKey: "appointment-1:CONFIRMATION:WHATSAPP:2026-10-04T12:00:00.000Z",
    });

    const logged = JSON.stringify([...info.mock.calls, ...log.mock.calls]);
    expect(logged).not.toContain("5511988887777");
    expect(logged).not.toContain("Olá Maria");
  });
});

describe("modo do WhatsApp", () => {
  it.each(["API", " api "])("usa a API da Meta com WHATSAPP_SENDER_MODE=%j", (mode) => {
    vi.stubEnv("WHATSAPP_SENDER_MODE", mode);

    expect(getMessageSender("WHATSAPP")).not.toBeInstanceOf(ConsoleMessageSender);
  });
});
