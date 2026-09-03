import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));

const { GET } = await import("@/app/auth/callback/route");

describe("callback de autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
  });

  it("valida token_hash de recuperação e encaminha para criar a nova senha", async () => {
    const request = new NextRequest(
      "https://painel.cotani.com.br/auth/callback?next=/update-password&token_hash=hash-seguro&type=recovery",
    );

    const response = await GET(request);

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-seguro",
      type: "recovery",
    });
    expect(response.headers.get("location")).toBe(
      "https://painel.cotani.com.br/update-password",
    );
  });

  it("rejeita callback sem código ou token", async () => {
    const request = new NextRequest(
      "https://painel.cotani.com.br/auth/callback?next=/update-password",
    );

    const response = await GET(request);

    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://painel.cotani.com.br/sign-in?error=auth_callback",
    );
  });
});
