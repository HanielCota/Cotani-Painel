"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlusIcon } from "lucide-react";

import { AppointmentForm } from "@/components/dashboard/appointment-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { replaceUrlSearchParams } from "@/lib/browser-url";
import { NEW_APPOINTMENT_EVENT, NEW_APPOINTMENT_PARAM } from "@/lib/shortcuts";

interface AppointmentFormDialogProps {
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  minStartTime: string;
  timeZone: string;
  initialCustomerId?: string;
  /** Horário pré-preenchido (YYYY-MM-DDTHH:mm). */
  initialStartTime?: string;
  /** Abertura controlada por fora (ex.: clique num horário vago da agenda), sem botão próprio. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Abre ao carregar (atalho "N" vindo de outra página, via ?novo=1). */
  defaultOpen?: boolean;
}

export function AppointmentFormDialog({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  ...props
}: AppointmentFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(Boolean(props.initialCustomerId) || defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next);
        return;
      }

      setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );
  const closeDialog = useCallback(() => setOpen(false), [setOpen]);

  // Atalho "N": o diálogo com botão próprio (o da página) atende o pedido.
  useEffect(() => {
    if (isControlled) return;
    if (defaultOpen) replaceUrlSearchParams({ [NEW_APPOINTMENT_PARAM]: null });
    function handleRequest(event: Event) {
      event.preventDefault();
      setUncontrolledOpen(true);
    }
    window.addEventListener(NEW_APPOINTMENT_EVENT, handleRequest);
    return () => window.removeEventListener(NEW_APPOINTMENT_EVENT, handleRequest);
  }, [isControlled, defaultOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isControlled ? null : (
        <DialogTrigger render={<Button type="button" />}>
          <CalendarPlusIcon data-icon="inline-start" />
          Novo atendimento
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Adicionar atendimento</DialogTitle>
        <DialogDescription className="sr-only">
          Cadastre o cliente, serviço, profissional, data e horário do atendimento.
        </DialogDescription>
        <AppointmentForm
          // Remonta ao trocar o horário escolhido para refletir o novo valor inicial.
          key={props.initialStartTime ?? "novo"}
          {...props}
          onSuccess={closeDialog}
          className="rounded-none border-0 shadow-none"
        />
      </DialogContent>
    </Dialog>
  );
}
