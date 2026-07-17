"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarXIcon } from "lucide-react";
import { toast } from "sonner";

import { cancelAppointmentByToken } from "@/server/actions/cancel-appointment";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";

interface CancelAppointmentFormProps {
  slug: string;
  token: string;
}

export function CancelAppointmentForm({ slug, token }: CancelAppointmentFormProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const nextResult = await cancelAppointmentByToken({ slug, token });

      setResult(nextResult);

      if (nextResult.status === "success") {
        toast.success(nextResult.message);
      } else {
        toast.error(nextResult.message);
      }
    });
  }

  if (result?.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <Alert variant="default">
          <CalendarXIcon aria-hidden="true" />
          <AlertTitle>Agendamento cancelado</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
        <Button nativeButton={false} render={<Link href={`/${slug}`} />} variant="outline">
          Fazer novo agendamento
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">
        Confirme abaixo para liberar o horário. Esta ação não pode ser desfeita.
      </p>
      {result?.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível cancelar</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" variant="destructive" disabled={isPending} onClick={handleCancel}>
        {isPending ? <Spinner data-icon="inline-start" /> : <CalendarXIcon data-icon="inline-start" />}
        {isPending ? "Cancelando..." : "Confirmar cancelamento"}
      </Button>
    </div>
  );
}
