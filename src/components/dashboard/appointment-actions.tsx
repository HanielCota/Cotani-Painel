"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, CircleOffIcon, EllipsisVerticalIcon, UserRoundXIcon } from "lucide-react";

import { updateAppointmentStatus } from "@/server/actions/appointments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { ActionResult } from "@/types";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH" | "OTHER";

interface AppointmentActionsProps {
  appointmentId: string;
  status: AppointmentStatus;
}

type NextAppointmentStatus = Exclude<AppointmentStatus, "PENDING">;

interface ActionOption {
  status: NextAppointmentStatus;
  label: string;
  icon: typeof CheckIcon;
  destructive?: boolean;
}

const actionsByStatus: Record<
  Exclude<AppointmentStatus, "COMPLETED" | "CANCELED" | "NO_SHOW">,
  ActionOption[]
> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmar", icon: CheckIcon },
    { status: "CANCELED", label: "Cancelar", icon: BanIcon, destructive: true },
    { status: "NO_SHOW", label: "Não compareceu", icon: UserRoundXIcon, destructive: true },
  ],
  CONFIRMED: [
    { status: "COMPLETED", label: "Concluir", icon: CheckIcon },
    { status: "CANCELED", label: "Cancelar", icon: BanIcon, destructive: true },
    { status: "NO_SHOW", label: "Não compareceu", icon: UserRoundXIcon, destructive: true },
  ],
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

const actionConfirmations: Partial<Record<AppointmentStatus, string>> = {
  CANCELED: "Tem certeza que deseja cancelar este atendimento? O horário será liberado.",
  NO_SHOW: "Deseja marcar este atendimento como falta?",
};

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  if (status === "COMPLETED" || status === "CANCELED" || status === "NO_SHOW") {
    return null;
  }

  const actions = actionsByStatus[status];

  function handleStatusChange(nextStatus: NextAppointmentStatus) {
    const confirmation = actionConfirmations[nextStatus];

    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    if (nextStatus === "COMPLETED") {
      setDropdownOpen(false);
      setCompleteDialogOpen(true);
      return;
    }

    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, { status: nextStatus });

      setResult(nextResult);

      if (nextResult.status === "success") {
        setDropdownOpen(false);
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
          className="group/button inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-foreground outline-none select-none transition-all hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-')]:size-3.5"
        >
          Ações
          {isPending ? <Spinner className="ml-1 size-3.5" /> : <EllipsisVerticalIcon className="ml-1 size-3.5" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <DropdownMenuItem
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
                disabled={isPending}
              >
                <Icon className="mr-2 size-4" />
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {result?.message ? (
        <Alert variant={result.status === "error" ? "destructive" : "default"} className="max-w-sm py-1.5">
          <CircleOffIcon aria-hidden="true" />
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir atendimento</DialogTitle>
            <DialogDescription>Informe como o cliente pagou para finalizar o atendimento.</DialogDescription>
          </DialogHeader>

          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o método de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((method) => (
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
