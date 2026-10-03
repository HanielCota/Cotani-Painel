import { describe, expect, it } from "vitest";

import { maskNotificationRecipient } from "@/lib/admin-display";

describe("maskNotificationRecipient", () => {
  it("preserves the email domain while masking the local part", () => {
    expect(maskNotificationRecipient("contato@exemplo.com")).toBe("c•••@exemplo.com");
  });

  it("shows only the last four digits of a phone number", () => {
    expect(maskNotificationRecipient("+55 (11) 99999-1234")).toBe("••••1234");
  });

  it("masks short or blank values safely", () => {
    expect(maskNotificationRecipient("12")).toBe("••••");
    expect(maskNotificationRecipient("   ")).toBe("-");
  });
});
