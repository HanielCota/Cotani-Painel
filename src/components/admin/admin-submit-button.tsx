"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface AdminSubmitButtonProps {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary";
  /** Pede confirmação explícita antes de enviar (ações destrutivas). */
  confirm?: { title: string; description: string };
}

export function AdminSubmitButton({ children, variant = "default", confirm }: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (!confirm) {
    return (
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? <Spinner /> : null}
        {children}
      </Button>
    );
  }

  function requestConfirmation() {
    // Valida o motivo obrigatório antes de abrir a confirmação.
    if (buttonRef.current?.form?.reportValidity()) setOpen(true);
  }

  function submit() {
    setOpen(false);
    buttonRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <Button ref={buttonRef} type="button" variant={variant} disabled={pending} onClick={requestConfirmation}>
        {pending ? <Spinner /> : null}
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" variant={variant === "destructive" ? "destructive" : "default"} onClick={submit}>{children}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
