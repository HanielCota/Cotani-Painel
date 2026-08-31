import { describe, expect, it } from "vitest";

import { matchesBearerSecret } from "@/lib/secure-compare";

describe("matchesBearerSecret", () => {
  it("aceita apenas o bearer token completo", () => {
    expect(matchesBearerSecret("Bearer segredo-forte", "segredo-forte")).toBe(true);
    expect(matchesBearerSecret("Bearer segredo", "segredo-forte")).toBe(false);
    expect(matchesBearerSecret(null, "segredo-forte")).toBe(false);
  });
});
