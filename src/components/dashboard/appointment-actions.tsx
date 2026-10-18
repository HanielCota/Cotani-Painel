"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, CircleOffIcon, EllipsisVerticalIcon, UserRoundXIcon } from "lucide-react";

import { updateAppointmentStatus } from "@/server/actions/appointments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  getAllowedAppointmentTransitions,
  isTerminalAppointmentStatus,
  paymentMethodLabels,
  type AppointmentStatusValue,
  type NextAppointmentStatus,
  type PaymentMethodValue,
} from "@/lib/appointment-status";
import type { ActionResult } from "@/types";

interface AppointmentActionsProps {
  appointmentId: string;
  status: AppointmentStatusValue;
  /** Início do atendimento; concluir/registrar falta só aparecem depois dele. */
  startTime?: string;
}

interface ActionOption {
  label: string;
  icon: typeof CheckIcon;
  destructive?: boolean;
}

const actionOptions: Record<NextAppointmentStatus, ActionOption> = {
  CONFIRMED: { label: "Confirmar", icon: CheckIcon },
  COMPLETED: { label: "Concluir", icon: CheckIcon },
  CANCELED: { label: "Cancelar", icon: BanIcon, destructive: true },
  NO_SHOW: { label: "Não compareceu", icon: UserRoundXIcon, destructive: true },
};

const actionConfirmations: Partial<Record<NextAppointmentStatus, { title: string; description: string; confirmLabel: string }>> = {
  CANCELED: {
    title: "Cancelar atendimento?",
    description: "O atendimento será cancelado e o horário ficará disponível novamente.",
    confirmLabel: "Cancelar atendimento",
  },
  NO_SHOW: {
    title: "Marcar como falta?",
    description: "O atendimento será registrado como não comparecimento no histórico do cliente.",
    confirmLabel: "Marcar como falta",
  },
};

export function AppointmentActions({ appointmentId, status, startTime }: AppointmentActionsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue | "">("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<NextAppointmentStatus | null>(null);
  const queryClient = useQueryClient();

  if (isTerminalAppointmentStatus(status)) {
    return null;
  }

  // Sem `startTime` (ex.: listas antigas) exibe todas; o servidor valida de qualquer forma.
  const actions = getAllowedAppointmentTransitions(status, startTime ?? new Date(0));
  const confirmation = confirmationStatus ? actionConfirmations[confirmationStatus] : null;

  function handleStatusChange(nextStatus: NextAppointmentStatus) {
    if (nextStatus === "COMPLETED") {
      setDropdownOpen(false);
      setCompleteDialogOpen(true);
      return;
    }

    if (actionConfirmations[nextStatus]) {
      setResult(null);
      setDropdownOpen(false);
      setConfirmationStatus(nextStatus);
      return;
    }

    updateStatus(nextStatus);
  }

  function updateStatus(nextStatus: NextAppointmentStatus) {
    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, { status: nextStatus });

      setResult(nextResult);

      if (nextResult.status === "success") {
        setDropdownOpen(false);
        setConfirmationStatus(null);
        await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    });
  }

  function handleComplete() {
    if (!paymentMethod) {
      setResult({ status: "error", message: "Selecione um método de pagamento." });
      return;
    }

    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, {
        status: "COMPLETED",
        paymentMethod,
      });

      setResult(nextResult);

      if (nextResult.status === "success") {
        setCompleteDialogOpen(false);
        setPaymentMethod("");
        await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger
          type="button"
          disabled={isPending}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ações
          {isPending ? <Spinner className="ml-1 size-3.5" /> : <EllipsisVerticalIcon className="ml-1 size-3.5" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {actions.map((nextStatus) => {
            const action = actionOptions[nextStatus];
            const Icon = action.icon;

            return (
              <DropdownMenuItem
                key={nextStatus}
                onClick={() => handleStatusChange(nextStatus)}
                className={action.destructive ? "whitespace-nowrap text-destructive focus:text-destructive" : "whitespace-nowrap"}
                disabled={isPending}
              >
                <Icon className="mr-2 size-4" />
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {result?.message && !confirmationStatus ? (
        <Alert variant={result.status === "error" ? "destructive" : "default"} className="max-w-sm py-1.5">
          <CircleOffIcon aria-hidden="true" />
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}

      <AlertDialog
        open={confirmationStatus !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirmationStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>

          {result?.status === "error" && result.message ? (
            <Alert variant="destructive">
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Voltar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending || !confirmationStatus}
              onClick={() => {
                if (confirmationStatus) updateStatus(confirmationStatus);
              }}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {confirmation?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir atendimento</DialogTitle>
            <DialogDescription>Informe como o cliente pagou para finalizar o atendimento.</DialogDescription>
          </DialogHeader>

          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethodValue)} items={paymentMethodLabels}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o método de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(paymentMethodLabels) as PaymentMethodValue[]).map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentMethodLabels[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {result?.status === "error" && result.message ? (
            <Alert variant="destructive" className="py-1.5">
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter showCloseButton>
            <Button onClick={handleComplete} disabled={isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isPending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
