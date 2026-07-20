import { describe, expect, it } from "vitest";

import { getPublicBookingUrl } from "@/lib/url";

describe("getPublicBookingUrl", () => {
  it("usa NEXT_PUBLIC_APP_URL quando definida", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.cotani.com.br";

    const url = await getPublicBookingUrl("barbearia-do-ze");

    expect(url).toBe("https://app.cotani.com.br/barbearia-do-ze");
  });

  it("remove barra final da NEXT_PUBLIC_APP_URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.cotani.com.br/";

    const url = await getPublicBookingUrl("barbearia-do-ze");

    expect(url).toBe("https://app.cotani.com.br/barbearia-do-ze");
  });

  it("usa headers quando APP_URL não está definida", async () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const url = await getPublicBookingUrl("barbearia-do-ze");

    expect(url).toBe("http://localhost:3000/barbearia-do-ze");

    process.env.NEXT_PUBLIC_APP_URL = original;
  });
});
