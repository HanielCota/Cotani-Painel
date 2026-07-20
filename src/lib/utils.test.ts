import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina classes simples", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("ignora valores falsy", () => {
    expect(cn("class1", false, null, undefined, "class2")).toBe("class1 class2");
  });

  it("mescla classes condicionais", () => {
    const isActive = true;
    const isDisabled = false;

    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("sobrescreve classes conflitantes do Tailwind", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
  });

  it("lida com objetos de classes", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
  });
});
