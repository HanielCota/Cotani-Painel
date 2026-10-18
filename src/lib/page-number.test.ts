import { describe, expect, it } from "vitest";

import { MAX_PAGE_NUMBER, parsePageNumber } from "@/lib/page-number";

describe("parsePageNumber", () => {
  it.each([
    [undefined, 1],
    [null, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-3", 1],
    ["4", 4],
    ["999999999", MAX_PAGE_NUMBER],
  ])("converte %j em %i", (value, expected) => {
    expect(parsePageNumber(value)).toBe(expected);
  });
});
