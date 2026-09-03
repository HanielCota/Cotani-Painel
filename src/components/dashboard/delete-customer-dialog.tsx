"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteCustomer } from "@/server/actions/customers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";

interface DeleteCustomerDialogProps {
  customerId: string;
  customerName: string;
}

export function DeleteCustomerDialog({ customerId, customerName }: DeleteCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleDelete() {
    startTransition(async () => {
      const nextResult = await deleteCustomer(customerId);

      if (nextResult.status === "success") {
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
        setOpen(false);
        return;
      }

      setResult(nextResult);
      toast.error(nextResult.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <Trash2Icon data-icon="inline-start" />
        Remover
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover cliente</DialogTitle>
          <DialogDescription>Esta ação não pode ser desfeita. Clientes com atendimentos não podem ser removidos.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Confirma a remoção de <strong className="font-medium text-foreground">{customerName}</strong>?
        </p>
        {result?.status === "error" && result.message ? (
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
            {isPending ? "Removendo..." : "Remover cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
