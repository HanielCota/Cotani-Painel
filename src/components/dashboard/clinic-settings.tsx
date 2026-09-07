"use client";

import { useActionState } from "react";
import { Settings2Icon } from "lucide-react";

import { saveClinicSettings } from "@/server/actions/clinic-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const initialState: ActionResult = { status: "success", message: "" };

interface ClinicSettingsProps {
  maxAppointmentsPerDay: number | null;
}

export function ClinicSettings({ maxAppointmentsPerDay }: ClinicSettingsProps) {
  const [state, formAction, isPending] = useActionState(saveClinicSettings, initialState);

  useActionFeedback(state);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border/80 bg-background/50 p-4">
      <div className="flex items-center gap-2">
        <Settings2Icon className="size-5 text-primary" />
        <h3 className="font-semibold">Limite diário de agendamentos</h3>
      </div>

      <Field>
        <FieldLabel htmlFor="maxAppointmentsPerDay">Máximo de atendimentos por dia</FieldLabel>
        <Input
          id="maxAppointmentsPerDay"
          name="maxAppointmentsPerDay"
          type="number"
          min={1}
          defaultValue={maxAppointmentsPerDay ?? ""}
          placeholder="Ilimitado"
          disabled={isPending}
          className="max-w-xs"
        />
        <FieldDescription>
          Deixe em branco para não limitar. Quando o limite for atingido, nenhum novo horário será exibido para aquele dia.
        </FieldDescription>
      </Field>

      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertTitle>{state.status === "error" ? "Não foi possível salvar" : "Configuração salva"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Spinner data-icon="inline-start" /> : <Settings2Icon data-icon="inline-start" />}
          {isPending ? "Salvando..." : "Salvar limite"}
        </Button>
      </div>
    </form>
  );
}
