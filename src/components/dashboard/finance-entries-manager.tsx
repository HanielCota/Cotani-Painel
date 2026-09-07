"use client";

import { useActionState, useEffect, useState } from "react";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  saveFinancialEntry,
  deleteFinancialEntry,
} from "@/server/actions/finance";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "PENDING" | "PARTIAL" | "PAID" | "REFUNDED" | "CANCELED";
  description: string;
  category: string | null;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  occurredAt: string;
  notes: string | null;
};
const statusLabel = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  REFUNDED: "Estornado",
  CANCELED: "Cancelado",
};
function EntryDialog({ entry }: { entry?: Entry }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveFinancialEntry, initial);
  const formId = `entry-${entry?.id ?? "new"}`;
  const fieldId = (name: string) => `${formId}-${name}`;
  const formRevision = entry
    ? [entry.id, entry.type, entry.status, entry.description, entry.category, entry.amount, entry.paidAmount, entry.dueDate, entry.occurredAt, entry.notes].join(":")
    : "new";
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      queueMicrotask(() => setOpen(false));
    } else toast.error(state.message);
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size={entry ? "sm" : "default"}
            variant={entry ? "outline" : "default"}
          />
        }
      >
        {entry ? <PencilIcon /> : <PlusIcon />}
        {entry ? "Editar" : "Nova movimentação"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Editar" : "Nova"} movimentação</DialogTitle>
          <DialogDescription>
            Registre receitas, despesas e valores a receber.
          </DialogDescription>
        </DialogHeader>
        <form
          key={formRevision}
          id={formId}
          action={action}
          className="grid gap-4 sm:grid-cols-2"
        >
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
          <div>
            <Label htmlFor={fieldId("type")}>Tipo</Label>
            <Select name="type" defaultValue={entry?.type ?? "INCOME"} items={{ INCOME: "Receita", EXPENSE: "Despesa" }}>
              <SelectTrigger id={fieldId("type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Receita</SelectItem>
                <SelectItem value="EXPENSE">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={fieldId("status")}>Status</Label>
            <Select name="status" defaultValue={entry?.status ?? "PENDING"} items={statusLabel}>
              <SelectTrigger id={fieldId("status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("description")}>Descrição</Label>
            <Input
              id={fieldId("description")}
              name="description"
              defaultValue={entry?.description ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor={fieldId("category")}>Categoria</Label>
            <Input id={fieldId("category")} name="category" defaultValue={entry?.category ?? ""} />
          </div>
          <div>
            <Label htmlFor={fieldId("amount")}>Valor total</Label>
            <Input
              id={fieldId("amount")}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={entry?.amount ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor={fieldId("paidAmount")}>Valor pago</Label>
            <Input
              id={fieldId("paidAmount")}
              name="paidAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={entry?.paidAmount ?? 0}
            />
          </div>
          <div>
            <Label htmlFor={fieldId("occurredAt")}>Data</Label>
            <Input
              id={fieldId("occurredAt")}
              name="occurredAt"
              type="date"
              defaultValue={
                entry?.occurredAt.slice(0, 10) ??
                new Date().toISOString().slice(0, 10)
              }
              required
            />
          </div>
          <div>
            <Label htmlFor={fieldId("dueDate")}>Vencimento</Label>
            <Input
              id={fieldId("dueDate")}
              name="dueDate"
              type="date"
              defaultValue={entry?.dueDate?.slice(0, 10) ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("notes")}>Observações</Label>
            <Textarea id={fieldId("notes")} name="notes" defaultValue={entry?.notes ?? ""} />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={pending}
          >
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function DeleteEntry({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    deleteFinancialEntry,
    initial,
  );
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      queueMicrotask(() => setOpen(false));
    } else toast.error(state.message);
  }, [state]);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" size="sm" variant="destructive" aria-label={`Excluir ${entry.description}`} />}>
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
          <AlertDialogDescription>
            A movimentação “{entry.description}” será removida definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="id" value={entry.id} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Excluindo..." : "Excluir movimentação"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function FinanceEntriesManager({
  entries,
  summary,
  pagination,
}: {
  entries: Entry[];
  summary: { received: number; paid: number; receivable: number; balance: number };
  pagination: { page: number; total: number; pageSize: number; period: string; siblingPage: number };
}) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">
            Receitas, despesas e contas a receber
          </h2>
          <p className="text-sm text-muted-foreground">
            Movimentações manuais complementam os atendimentos concluídos.
          </p>
        </div>
        <EntryDialog />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Recebido", summary.received],
          ["Despesas pagas", summary.paid],
          ["A receber", summary.receivable],
          ["Saldo realizado", summary.balance],
        ].map(([label, value]) => (
          <Card
            key={String(label)}
            className="py-0"
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(Number(value))}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Pago / Total</TableHead><TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length ? (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.occurredAt)}</TableCell>
                  <TableCell>
                    {entry.description}
                    <span className="block text-xs text-muted-foreground">
                      {entry.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    {entry.type === "INCOME" ? "Receita" : "Despesa"}
                  </TableCell>
                  <TableCell>{statusLabel[entry.status]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(entry.paidAmount)} / {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2 p-2">
                      <EntryDialog entry={entry} />
                      <DeleteEntry entry={entry} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  Nenhuma movimentação manual neste período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
        <div className="divide-y px-4 md:hidden">
          {entries.length ? entries.map((entry) => (
            <article key={entry.id} className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-medium">{entry.description}</h3><p className="text-xs text-muted-foreground">{entry.category || (entry.type === "INCOME" ? "Receita" : "Despesa")}</p></div>
                <span className="text-xs font-medium">{statusLabel[entry.status]}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{formatDate(entry.occurredAt)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Pago / total</dt><dd>{formatCurrency(entry.paidAmount)} / {formatCurrency(entry.amount)}</dd></div>
              </dl>
              <div className="flex gap-2"><EntryDialog entry={entry} /><DeleteEntry entry={entry} /></div>
            </article>
          )) : <p className="py-8 text-center text-muted-foreground">Nenhuma movimentação manual neste período.</p>}
        </div>
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
