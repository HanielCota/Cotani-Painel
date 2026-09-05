"use client";

import { useState, useTransition } from "react";
import { AlertTriangleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { cancelSubscription } from "@/server/actions/subscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function CancelSubscriptionDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSubscription();

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <XIcon data-icon="inline-start" className="size-4" />
        Cancelar assinatura
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-destructive" />
            Cancelar assinatura
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja cancelar? O acesso ao painel e o link público de agendamento serão
            desativados ao fim do período pago.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            Você pode desfazer o cancelamento nesta tela enquanto o período pago ainda estiver vigente.
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <DialogClose render={<Button type="button" variant="outline" disabled={isPending} className="w-full sm:w-auto" />}>
            Voltar
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {isPending ? <Spinner data-icon="inline-start" /> : <XIcon data-icon="inline-start" className="size-4" />}
            {isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
