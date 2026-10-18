"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { saveFinancialEntry } from "@/server/actions/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { financialEntryStatusLabels, financialEntryTypeLabels } from "@/lib/display-labels";
import { INITIAL_ACTION_RESULT } from "@/types";
import type { FinanceEntry } from "./finance-entry-types";

/** Data local do navegador em YYYY-MM-DD (toISOString usaria UTC e erraria após 21h). */
function todayInputValue() {
  return new Date().toLocaleDateString("sv-SE");
}

export function FinanceEntryDialog({ entry }: { entry?: FinanceEntry }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveFinancialEntry, INITIAL_ACTION_RESULT);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const formId = `entry-${entry?.id ?? "new"}`;
  const fieldId = (name: string) => `${formId}-${name}`;
  // Remonta o formulário quando o lançamento muda no servidor.
  const formRevision = entry
    ? [entry.id, entry.type, entry.status, entry.description, entry.category, entry.amount, entry.paidAmount, entry.dueDate, entry.occurredAt, entry.notes].join(":")
    : "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size={entry ? "sm" : "default"} variant={entry ? "outline" : "default"} />}
      >
        {entry ? <PencilIcon /> : <PlusIcon />}
        {entry ? "Editar" : "Nova movimentação"}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
          <DialogDescription>Registre receitas, despesas e valores a receber.</DialogDescription>
        </DialogHeader>
        <form key={formRevision} id={formId} action={action} className="grid gap-4 sm:grid-cols-2">
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
          <Field>
            <FieldLabel htmlFor={fieldId("type")}>Tipo</FieldLabel>
            <Select name="type" defaultValue={entry?.type ?? "INCOME"} items={financialEntryTypeLabels}>
              <SelectTrigger id={fieldId("type")} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(financialEntryTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("status")}>Situação</FieldLabel>
            <Select name="status" defaultValue={entry?.status ?? "PENDING"} items={financialEntryStatusLabels}>
              <SelectTrigger id={fieldId("status")} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(financialEntryStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={fieldId("description")}>Descrição</FieldLabel>
            <Input id={fieldId("description")} name="description" defaultValue={entry?.description ?? ""} minLength={2} maxLength={160} required />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("category")}>Categoria</FieldLabel>
            <Input id={fieldId("category")} name="category" placeholder="Ex.: aluguel, produtos" defaultValue={entry?.category ?? ""} maxLength={80} />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("amount")}>Valor total (R$)</FieldLabel>
            <Input id={fieldId("amount")} name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" defaultValue={entry?.amount ?? ""} required />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("paidAmount")}>Valor pago (R$)</FieldLabel>
            <Input id={fieldId("paidAmount")} name="paidAmount" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={entry?.paidAmount || ""} />
            <FieldDescription>Em branco com situação “Pago” considera o valor total.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("occurredAt")}>Data</FieldLabel>
            <Input id={fieldId("occurredAt")} name="occurredAt" type="date" defaultValue={entry?.occurredAt.slice(0, 10) ?? todayInputValue()} required />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("dueDate")}>Vencimento</FieldLabel>
            <Input id={fieldId("dueDate")} name="dueDate" type="date" defaultValue={entry?.dueDate?.slice(0, 10) ?? ""} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={fieldId("notes")}>Observações</FieldLabel>
            <Textarea id={fieldId("notes")} name="notes" defaultValue={entry?.notes ?? ""} maxLength={1000} />
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
