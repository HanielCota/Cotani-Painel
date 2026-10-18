import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

// Largura e altura ficam no cabeçalho IHDR do PNG, a partir do byte 16.
function pngSize(file: string) {
  const header = readFileSync(file);
  return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
}

describe("manifest do app", () => {
  it("declara ícones que existem em public/ com o tamanho real", () => {
    for (const icon of manifest().icons ?? []) {
      const file = path.join(process.cwd(), "public", icon.src);

      expect(() => readFileSync(file)).not.toThrow();
      if (icon.type === "image/png") expect(pngSize(file)).toBe(icon.sizes);
    }
  });
});
