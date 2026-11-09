import { afterEach, describe, expect, it, vi } from "vitest";

import { MissingConfigurationError, readConfiguredAppUrl, requireConfiguredAppUrl } from "@/config/app-url";

describe("app-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("remove espaços e a barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", " https://painel.example.com/ ");

    expect(readConfiguredAppUrl()).toBe("https://painel.example.com");
  });

  it("devolve null sem a variável", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(readConfiguredAppUrl()).toBeNull();
  });

  it("falha com erro tipado quando a variável é obrigatória", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(() => requireConfiguredAppUrl()).toThrow(MissingConfigurationError);
  });
});
