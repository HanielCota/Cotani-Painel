import { afterEach, describe, expect, it, vi } from "vitest";

import { ignoreFailure } from "@/lib/ignore-failure";

describe("ignoreFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não interrompe o fluxo quando a tarefa falha", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(ignoreFailure(Promise.reject(new Error("falhou")), "Tarefa secundária")).resolves.toBeUndefined();
  });

  it("registra a falha como aviso, com a descrição e sem a mensagem do erro", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = Object.assign(new Error("arquivo de maria@example.com"), { code: "storage_error" });

    await ignoreFailure(Promise.reject(failure), "Falha ao remover imagem do storage");

    const logged = JSON.stringify(consoleWarn.mock.calls);
    expect(logged).toContain("Falha ao remover imagem do storage");
    expect(logged).toContain("storage_error");
    expect(logged).not.toContain("maria@example.com");
  });
});
