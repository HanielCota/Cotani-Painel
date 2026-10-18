"use client";

import { useCallback, useState } from "react";
import { CalendarPlusIcon } from "lucide-react";

import { AppointmentForm } from "@/components/dashboard/appointment-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AppointmentFormDialogProps {
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  minStartTime: string;
  timeZone: string;
  initialCustomerId?: string;
}

export function AppointmentFormDialog(props: AppointmentFormDialogProps) {
  const [open, setOpen] = useState(Boolean(props.initialCustomerId));
  const closeDialog = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        <CalendarPlusIcon data-icon="inline-start" />
        Novo atendimento
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Adicionar atendimento</DialogTitle>
        <DialogDescription className="sr-only">
          Cadastre o cliente, serviço, profissional, data e horário do atendimento.
        </DialogDescription>
        <AppointmentForm
          {...props}
          onSuccess={closeDialog}
          className="rounded-none border-0 shadow-none"
        />
      </DialogContent>
    </Dialog>
  );
}
