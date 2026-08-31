import { describe, expect, it } from "vitest";

import { getClientIpFromHeaders } from "@/lib/get-client-ip";

function headerReader(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe("getClientIpFromHeaders", () => {
  it("prefere o cabeçalho protegido da Vercel", () => {
    const ip = getClientIpFromHeaders(headerReader({
      "x-vercel-forwarded-for": "203.0.113.10",
      "x-forwarded-for": "198.51.100.2",
    }));

    expect(ip).toBe("203.0.113.10");
  });

  it("usa o primeiro endereço encaminhado fora da Vercel", () => {
    const ip = getClientIpFromHeaders(headerReader({ "x-forwarded-for": "203.0.113.20, 10.0.0.1" }));

    expect(ip).toBe("203.0.113.20");
  });

  it("retorna unknown sem cabeçalho de plataforma", () => {
    expect(getClientIpFromHeaders(headerReader({}))).toBe("unknown");
  });
});
