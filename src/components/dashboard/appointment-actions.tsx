"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, CircleOffIcon, UserRoundXIcon } from "lucide-react";

import { updateAppointmentStatus } from "@/server/actions/appointments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

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

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const actions = status === "PENDING" ? ["CONFIRMED", "CANCELED", "NO_SHOW"] as const : ["COMPLETED", "CANCELED", "NO_SHOW"] as const;

  function handleStatusChange(nextStatus: (typeof actions)[number]) {
    startTransition(async () => {
      const nextResult = await updateAppointmentStatus(appointmentId, nextStatus);

      setResult(nextResult);

      if (nextResult.status === "success") {
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
            <Button key={nextStatus} type="button" size="sm" variant={action.variant} disabled={isPending} onClick={() => handleStatusChange(nextStatus)}>
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
    </div>
  );
}
