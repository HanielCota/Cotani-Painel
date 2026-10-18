import { afterEach, describe, expect, it, vi } from "vitest";

import { getMessageSender } from "./message-sender";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
