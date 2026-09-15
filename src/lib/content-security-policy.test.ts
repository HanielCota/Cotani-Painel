import { afterEach, describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

describe("buildContentSecurityPolicy", () => {
  afterEach(() => delete process.env.NEXT_PUBLIC_SUPABASE_URL);

  it("usa nonce para scripts e estilos sem liberar scripts inline", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    const policy = buildContentSecurityPolicy("nonce-seguro");
    expect(policy).toContain("script-src 'self' https://challenges.cloudflare.com 'nonce-nonce-seguro' 'strict-dynamic'");
    expect(policy).toContain("style-src-elem 'self' 'nonce-nonce-seguro'");
    expect(policy).toContain("'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("https://project.supabase.co");
  });

  it("permite unsafe-eval apenas no desenvolvimento", () => {
    expect(buildContentSecurityPolicy("nonce", true)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("nonce", false)).not.toContain("'unsafe-eval'");
  });
});
