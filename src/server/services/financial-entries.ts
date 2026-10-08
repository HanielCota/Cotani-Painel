import type { FinancialEntryStatus } from "@/generated/prisma/enums";

/**
 * Regra de pagamento de um lançamento manual: o status final é derivado do
 * valor efetivamente pago, exceto estornos/cancelamentos (sempre zerados).
 * Marcar "Pago" sem informar o valor pago (vazio ou zero) significa quitação
 * integral - antes isso rebaixava silenciosamente o lançamento para "Pendente".
 */
export function normalizeEntryPayment(status: FinancialEntryStatus, amount: number, paidAmount: number | undefined) {
  if (status === "REFUNDED" || status === "CANCELED") return { status, paidAmount: 0 };
  const paid = status === "PAID" && !paidAmount ? amount : paidAmount ?? 0;
  if (paid <= 0) return { status: "PENDING" as const, paidAmount: 0 };
  if (paid >= amount) return { status: "PAID" as const, paidAmount: amount };
  return { status: "PARTIAL" as const, paidAmount: paid };
}
