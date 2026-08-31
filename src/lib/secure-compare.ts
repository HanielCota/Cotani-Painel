import { timingSafeEqual } from "node:crypto";

export function matchesBearerSecret(authorization: string | null, secret: string): boolean {
  const actual = Buffer.from(authorization ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
