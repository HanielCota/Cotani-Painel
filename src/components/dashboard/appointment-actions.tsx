"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, CircleOffIcon, UserRoundXIcon } from "lucide-react";

import { updateAppointmentStatus } from "@/server/actions/appointments";
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
} from "@/components/ui/dialog";
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

const actionLabels = {
  CONFIRMED: { label: "Confirmar", icon: CheckIcon, variant: "outline" as const },
  COMPLETED: { label: "Concluir", icon: CheckIcon, variant: "default" as const },
  CANCELED: { label: "Cancelar", icon: BanIcon, variant: "outline" as const },
  NO_SHOW: { label: "Não compareceu", icon: UserRoundXIcon, variant: "outline" as const },
};

const actionConfirmations: Partial<Record<keyof typeof actionLabels, string>> = {
  CANCELED: "Tem certeza que deseja cancelar este atendimento? O horário será liberado.",
  NO_SHOW: "Deseja marcar este atendimento como falta?",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const queryClient = useQueryClient();
  const actions = status === "PENDING" ? (["CONFIRMED", "CANCELED", "NO_SHOW"] as const) : (["COMPLETED", "CANCELED", "NO_SHOW"] as const);

  function handleStatusChange(nextStatus: (typeof actions)[number]) {
    const confirmation = actionConfirmations[nextStatus];

    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    if (nextStatus === "COMPLETED") {
      setCompleteDialogOpen(true);
      return;
    }

    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, { status: nextStatus });

      setResult(nextResult);

      if (nextResult.status === "success") {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    });
  }

  return (
    <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {actions.map((nextStatus) => {
          const action = actionLabels[nextStatus];
          const Icon = action.icon;

          return (
            <Button
              key={nextStatus}
              type="button"
              size="sm"
              variant={action.variant}
              disabled={isPending}
              onClick={() => handleStatusChange(nextStatus)}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />}
              {action.label}
            </Button>
          );
        })}
      </div>

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
            <Button onClick={handleComplete} disabled={isPending} className="bg-[#82D951] text-white hover:bg-[#75c448]">
              {isPending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
