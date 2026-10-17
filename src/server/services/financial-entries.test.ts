import { describe, expect, it } from "vitest";
import { normalizeEntryPayment } from "./financial-entries";

describe("normalizeEntryPayment", () => {
  it("Pago sem valor informado quita o total", () => {
    expect(normalizeEntryPayment("PAID", 100, undefined)).toEqual({ status: "PAID", paidAmount: 100 });
    expect(normalizeEntryPayment("PAID", 100, 0)).toEqual({ status: "PAID", paidAmount: 100 });
  });

  it("deriva parcial/pendente do valor pago", () => {
    expect(normalizeEntryPayment("PENDING", 100, 40)).toEqual({ status: "PARTIAL", paidAmount: 40 });
    expect(normalizeEntryPayment("PARTIAL", 100, 0)).toEqual({ status: "PENDING", paidAmount: 0 });
    expect(normalizeEntryPayment("PARTIAL", 100, 150)).toEqual({ status: "PAID", paidAmount: 100 });
  });

  it("estorno e cancelamento zeram o pago", () => {
    expect(normalizeEntryPayment("REFUNDED", 100, 100)).toEqual({ status: "REFUNDED", paidAmount: 0 });
  });
});
