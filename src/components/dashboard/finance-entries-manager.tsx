import { ReceiptTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { financialEntryStatusBadgeVariant, financialEntryStatusLabel, financialEntryTypeLabel } from "@/lib/display-labels";
import { formatCurrency, formatDateOnly } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./page-header";
import { FinanceEntryDelete } from "./finance-entry-delete";
import { FinanceEntryDialog } from "./finance-entry-dialog";
import type { FinanceEntry } from "./finance-entry-types";

export type { FinanceEntry } from "./finance-entry-types";

type EntriesSummary = { received: number; paid: number; receivable: number; balance: number };
type EntriesPagination = { page: number; total: number; pageSize: number; period: string; siblingPage: number };

function EntryStatus({ entry }: { entry: FinanceEntry }) {
  return <Badge variant={financialEntryStatusBadgeVariant(entry.status)}>{financialEntryStatusLabel(entry.status)}</Badge>;
}

function EntryAmount({ entry }: { entry: FinanceEntry }) {
  const signed = entry.type === "EXPENSE" ? "text-destructive" : "text-success";
  return (
    <span className="tabular-nums">
      <span className={cn("font-medium", signed)}>{formatCurrency(entry.paidAmount)}</span>
      <span className="text-muted-foreground"> / {formatCurrency(entry.amount)}</span>
    </span>
  );
}

function EntryActions({ entry }: { entry: FinanceEntry }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <FinanceEntryDialog entry={entry} />
      <FinanceEntryDelete entry={entry} />
    </div>
  );
}

function EntriesSummaryCards({ summary }: { summary: EntriesSummary }) {
  const items = [
    { label: "Recebido", value: summary.received, tone: "text-success" },
    { label: "Despesas pagas", value: summary.paid, tone: "text-destructive" },
    { label: "A receber", value: summary.receivable, tone: "text-warning" },
    { label: "Saldo realizado", value: summary.balance, tone: summary.balance < 0 ? "text-destructive" : "text-foreground" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", item.tone)}>{formatCurrency(item.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EntriesEmpty() {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ReceiptTextIcon /></EmptyMedia>
        <EmptyTitle>Nenhuma movimentação neste período</EmptyTitle>
        <EmptyDescription>Registre aluguel, compras de produtos ou valores a receber para acompanhar o caixa.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function FinanceEntriesManager({
  entries,
  summary,
  pagination,
}: {
  entries: FinanceEntry[];
  summary: EntriesSummary;
  pagination: EntriesPagination;
}) {
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="finance-entries-title">
      <SectionHeader
        id="finance-entries-title"
        title="Receitas, despesas e contas a receber"
        description="Movimentações manuais complementam os atendimentos concluídos."
        actions={<FinanceEntryDialog />}
      />

      <EntriesSummaryCards summary={summary} />

      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        {entries.length === 0 ? <EntriesEmpty /> : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Pago / total</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="tabular-nums">{formatDateOnly(entry.occurredAt)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{entry.description}</span>
                        {entry.category ? <span className="block text-xs text-muted-foreground">{entry.category}</span> : null}
                      </TableCell>
                      <TableCell>{financialEntryTypeLabel(entry.type)}</TableCell>
                      <TableCell><EntryStatus entry={entry} /></TableCell>
                      <TableCell className="text-right"><EntryAmount entry={entry} /></TableCell>
                      <TableCell><EntryActions entry={entry} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {entries.map((entry) => (
                <li key={entry.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{entry.description}</h3>
                      <p className="text-xs text-muted-foreground">
                        {financialEntryTypeLabel(entry.type)}{entry.category ? ` · ${entry.category}` : ""} · {formatDateOnly(entry.occurredAt)}
                      </p>
                    </div>
                    <EntryStatus entry={entry} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <EntryAmount entry={entry} />
                    <EntryActions entry={entry} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <PaginationNav
        page={pagination.page}
        pageCount={Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
        totalItems={pagination.total}
        pageSize={pagination.pageSize}
        itemLabel="movimentações"
        hrefForPage={(nextPage) => `/dashboard/financeiro?period=${pagination.period}&page=${pagination.siblingPage}&entriesPage=${nextPage}`}
      />
    </section>
  );
}
