import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/server/services/landing-checkout", () => ({
  createLandingCheckout: mocks.create,
  LandingCheckoutConflictError: class LandingCheckoutConflictError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

const { OPTIONS, POST } = await import("./route");

function request(body: unknown, origin = "https://cotani.com.br") {
  return new NextRequest("https://painel.cotani.com.br/api/public/subscription/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

function requestWithoutOrigin(body: unknown) {
  return new NextRequest("https://painel.cotani.com.br/api/public/subscription/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Maria Silva",
  email: "MARIA@example.com",
  business: "Studio Beleza",
  phone: "(11) 99999-9999",
  plan: "professional",
  cycle: "anual",
  acceptedTerms: true,
  website: "",
};

describe("checkout público da landing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.create.mockResolvedValue({ checkoutId: "id", checkoutUrl: "https://mercadopago.com/checkout" });
  });

  it("aceita preflight somente da landing autorizada", async () => {
    const allowed = await OPTIONS(request({}));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://cotani.com.br");
    expect((await OPTIONS(request({}, "https://malicioso.example"))).status).toBe(403);
  });

  it("normaliza e converte plano e ciclo para o domínio do painel", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "maria@example.com",
      plan: "PROFESSIONAL",
      cycle: "ANNUAL",
    }));
    expect(response.headers.get("access-control-allow-origin")).toBe("https://cotani.com.br");
  });

  it("recusa termos não aceitos e origem não autorizada", async () => {
    expect((await POST(request({ ...validBody, acceptedTerms: false }))).status).toBe(400);
    expect((await POST(request(validBody, "https://malicioso.example"))).status).toBe(403);
    expect((await POST(requestWithoutOrigin(validBody))).status).toBe(403);
    expect((await POST(request({ ...validBody, phone: "telefone falso" }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("limita abuso antes de criar cobrança", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    expect((await POST(request(validBody))).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
