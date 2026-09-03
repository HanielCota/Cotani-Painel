import { describe, expect, it } from "vitest";

import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";

describe("readRequestText", () => {
  it("lê um corpo dentro do limite", async () => {
    const request = new Request("https://cotani.test/webhook", { method: "POST", body: "olá" });

    await expect(readRequestText(request, 16)).resolves.toBe("olá");
  });

  it("rejeita pelo Content-Length antes de ler", async () => {
    const request = new Request("https://cotani.test/webhook", {
      method: "POST",
      headers: { "content-length": "1024" },
      body: "x",
    });

    await expect(readRequestText(request, 32)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejeita corpo em streaming que ultrapassa o limite", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("1234"));
        controller.enqueue(encoder.encode("5678"));
        controller.close();
      },
    });
    const request = new Request("https://cotani.test/webhook", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readRequestText(request, 6)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
