import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "@/lib/fetch-json";

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna JSON em resposta bem-sucedida", async () => {
    const mockResponse = {
      ok: true,
      redirected: false,
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn().mockResolvedValue({ data: "value" }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    const result = await fetchJson("/api/data");

    expect(result).toEqual({ data: "value" });
  });

  it("lança erro em resposta não-OK", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      redirected: false,
      headers: new Headers({ "content-type": "application/json" }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    await expect(fetchJson("/api/data")).rejects.toThrow("Falha na requisição");
  });

  it("redireciona para login quando recebe HTML", async () => {
    const href = { value: "" };
    const originalLocation = window.location;
    // @ts-expect-error substituindo location para teste
    delete window.location;
    // @ts-expect-error substituindo location para teste
    window.location = { set href(value: string) { href.value = value; } } as unknown as Location;

    const mockResponse = {
      ok: true,
      redirected: true,
      headers: new Headers({ "content-type": "text/html" }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    await expect(fetchJson("/api/data")).rejects.toThrow("Sessão expirada");
    expect(href.value).toBe("/sign-in");

    // @ts-expect-error restaurando location original
    window.location = originalLocation;
  });
});
