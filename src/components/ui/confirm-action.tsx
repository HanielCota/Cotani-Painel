"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";

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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface ConfirmActionProps {
  /** Elemento que abre a confirmação (geralmente um `<Button />`). */
  trigger: ReactElement;
  triggerContent: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  /** Retorne `false` para manter o diálogo aberto (ex.: erro exibido em toast). */
  onConfirm: () => Promise<boolean | void> | boolean | void;
}

/**
 * Confirmação padrão para ações sensíveis ou difíceis de desfazer
 * (desativar cadastro, encerrar sessões, desligar 2FA...).
 */
export function ConfirmAction({ trigger, triggerContent, title, description, confirmLabel, pendingLabel = "Processando...", destructive = true, onConfirm }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const keepOpen = (await onConfirm()) === false;
      if (!keepOpen) setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!isPending) setOpen(next); }}>
      <AlertDialogTrigger render={trigger}>{triggerContent}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={isPending} onClick={confirm}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
