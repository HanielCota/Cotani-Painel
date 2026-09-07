"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billingCycleLabel, paymentStatusLabel, subscriptionPlanLabel } from "@/lib/display-labels";
import { formatCurrency } from "@/lib/formatters";
import { usePagination } from "@/hooks/use-pagination";
import type { PaymentHistoryItem } from "@/server/services/payment-history";

const paymentStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  paid: "success",
  approved: "success",
  pending: "secondary",
  refunded: "destructive",
  cancelled: "destructive",
};

export function PaymentHistoryTable({ payments }: { payments: PaymentHistoryItem[] }) {
  const pagination = usePagination(payments);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {pagination.pageItems.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-muted-foreground">{format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                <TableCell>{subscriptionPlanLabel(payment.plan)} · {billingCycleLabel(payment.billingCycle)}</TableCell>
                <TableCell><Badge variant={paymentStatusVariant[payment.status] ?? "secondary"}>{paymentStatusLabel(payment.status)}</Badge></TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={payments.length} onPageChange={pagination.setPage} itemLabelPlural="pagamentos" />
    </div>
  );
}
