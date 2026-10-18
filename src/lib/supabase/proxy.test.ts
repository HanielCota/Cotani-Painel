import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

vi.mock("@/lib/supabase/config", () => ({
  getPublicSupabaseConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "test-key",
  }),
}));

const { updateSupabaseSession } = await import("@/lib/supabase/proxy");

describe("redirecionamentos de sessão", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite voltar ao login durante uma sessão criada por recuperação de senha", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal1" } }, error: null });

    const response = await updateSupabaseSession(new NextRequest("https://painel.cotani.com.br/sign-in"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("continua protegendo o dashboard de visitantes sem sessão", async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const response = await updateSupabaseSession(new NextRequest("https://painel.cotani.com.br/dashboard"));

    expect(response.headers.get("location")).toBe("https://painel.cotani.com.br/sign-in?redirect=%2Fdashboard");
  });

  it("mantém uma recuperação pendente fora do painel e na mesma tela", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal1" } }, error: null });
    const request = new NextRequest("https://painel.cotani.com.br/dashboard");
    request.cookies.set("cotani_recovery_pending", "1");

    const response = await updateSupabaseSession(request);

    expect(response.headers.get("location")).toBe("https://painel.cotani.com.br/auth/confirm-recovery");
  });

  it("não permite usar APIs privadas com a sessão temporária de recuperação", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal1" } }, error: null });
    const request = new NextRequest("https://painel.cotani.com.br/api/appointments");
    request.cookies.set("cotani_recovery_pending", "1");

    const response = await updateSupabaseSession(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("identifica recuperação pelo token mesmo sem o cookie temporário", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", aal: "aal1", amr: [{ method: "recovery" }] } },
      error: null,
    });

    const response = await updateSupabaseSession(new NextRequest("https://painel.cotani.com.br/dashboard"));

    expect(response.headers.get("location")).toBe("https://painel.cotani.com.br/auth/confirm-recovery");
  });
});
