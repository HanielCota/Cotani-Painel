"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { deleteFinancialEntry } from "@/server/actions/finance";
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
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { INITIAL_ACTION_RESULT } from "@/types";
import type { FinanceEntry } from "./finance-entry-types";

export function FinanceEntryDelete({ entry }: { entry: FinanceEntry }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteFinancialEntry, INITIAL_ACTION_RESULT);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Excluir ${entry.description}`} />}
      >
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
