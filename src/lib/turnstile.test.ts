import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TurnstileConfigurationError, verifyTurnstileToken } from "@/lib/turnstile";

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("permite desenvolvimento sem segredo configurado", async () => {
    await expect(verifyTurnstileToken("token")).resolves.toBe(true);
  });

  it("falha de forma fechada em produção sem segredo", async () => {
    vi.stubEnv("APP_ENV", "production");
    await expect(verifyTurnstileToken("token")).rejects.toBeInstanceOf(TurnstileConfigurationError);
  });

  it("considera NODE_ENV de produção mesmo fora da Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(verifyTurnstileToken("token")).rejects.toBeInstanceOf(TurnstileConfigurationError);
  });

  it("aceita somente resposta válida para o checkout", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, action: "checkout" }) }));
    await expect(verifyTurnstileToken("token", "127.0.0.1")).resolves.toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, action: "login" }) } as Response);
    await expect(verifyTurnstileToken("token")).resolves.toBe(false);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response);
    await expect(verifyTurnstileToken("token")).resolves.toBe(false);
  });

  it("aceita ação ausente somente com a chave oficial de teste", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
    await expect(verifyTurnstileToken("token")).resolves.toBe(true);
  });
});
