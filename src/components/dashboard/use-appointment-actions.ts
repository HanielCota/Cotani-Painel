import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { updateAppointmentStatus } from "@/server/actions/appointments";
import type { NextAppointmentStatus, PaymentMethodValue } from "@/lib/appointment-status";
import type { ActionResult } from "@/types";

export interface ActionConfirmation {
  title: string;
  description: string;
  confirmLabel: string;
}

export const actionConfirmations: Partial<Record<NextAppointmentStatus, ActionConfirmation>> = {
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

type StatusUpdateInput = Parameters<typeof updateAppointmentStatus>[1];

function useStatusUpdate(appointmentId: string) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function submitStatusUpdate(input: StatusUpdateInput, onSuccess: () => void) {
    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, input);

      setResult(nextResult);
      if (nextResult.status !== "success") return;

      onSuccess();
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    });
  }

  return { result, setResult, isPending, submitStatusUpdate };
}

export function useAppointmentActions(appointmentId: string) {
  const { result, setResult, isPending, submitStatusUpdate } = useStatusUpdate(appointmentId);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue | "">("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<NextAppointmentStatus | null>(null);

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
    submitStatusUpdate({ status: nextStatus }, () => {
      setDropdownOpen(false);
      setConfirmationStatus(null);
    });
  }

  function handleComplete() {
    if (!paymentMethod) {
      setResult({ status: "error", message: "Selecione um método de pagamento." });
      return;
    }

    submitStatusUpdate({ status: "COMPLETED", paymentMethod }, () => {
      setCompleteDialogOpen(false);
      setPaymentMethod("");
    });
  }

  function handleConfirmationOpenChange(open: boolean) {
    if (!open && !isPending) setConfirmationStatus(null);
  }

  function confirmPendingStatus() {
    if (confirmationStatus) updateStatus(confirmationStatus);
  }

  return {
    result,
    isPending,
    completeDialogOpen,
    setCompleteDialogOpen,
    paymentMethod,
    setPaymentMethod,
    dropdownOpen,
    setDropdownOpen,
    confirmationStatus,
    handleStatusChange,
    handleComplete,
    handleConfirmationOpenChange,
    confirmPendingStatus,
  };
}
