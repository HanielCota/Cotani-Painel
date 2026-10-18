import type { financialEntryStatusLabels, financialEntryTypeLabels } from "@/lib/display-labels";

/** Lançamento manual serializado para os componentes cliente do financeiro. */
export type FinanceEntry = {
  id: string;
  type: keyof typeof financialEntryTypeLabels;
  status: keyof typeof financialEntryStatusLabels;
  description: string;
  category: string | null;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  occurredAt: string;
  notes: string | null;
};
