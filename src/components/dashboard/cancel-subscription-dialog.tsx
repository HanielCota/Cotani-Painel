"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleOffIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { cancelSubscription } from "@/server/actions/subscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

export function CancelSubscriptionDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSubscription();

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="outline" />}>
        <CircleOffIcon data-icon="inline-start" />
        Cancelar assinatura
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[95vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon aria-hidden="true" className="size-5 text-destructive" />
            Cancelar assinatura
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja cancelar? O acesso ao painel e o link público de agendamento serão
            desativados ao fim do período pago.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            Você pode desfazer o cancelamento nesta tela enquanto o período pago ainda estiver vigente.
          </AlertDescription>
        </Alert>

        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel disabled={isPending} className="w-full sm:w-auto">
            Voltar
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {isPending ? <Spinner data-icon="inline-start" /> : <CircleOffIcon data-icon="inline-start" />}
            {isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
