import { afterEach, describe, expect, it, vi } from "vitest";

import { isWhatsAppApiMode } from "@/server/services/messaging/sender-mode";

describe("isWhatsAppApiMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["api", "API", " api "])("reconhece %j como modo API", (value) => {
    vi.stubEnv("WHATSAPP_SENDER_MODE", value);

    expect(isWhatsAppApiMode()).toBe(true);
  });

  it.each(["manual", "", undefined])("trata %j como envio manual", (value) => {
    vi.stubEnv("WHATSAPP_SENDER_MODE", value);

    expect(isWhatsAppApiMode()).toBe(false);
  });
});
