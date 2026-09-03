"use client";

import { useActionState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClockIcon } from "lucide-react";
import { toast } from "sonner";

import { rescheduleAppointmentFromForm } from "@/server/actions/appointments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

interface RescheduleAppointmentDialogProps {
  appointmentId: string;
  currentStartTime: string;
  minStartTime: string;
}

export function RescheduleAppointmentDialog({ appointmentId, currentStartTime, minStartTime }: RescheduleAppointmentDialogProps) {
  const [state, formAction, isPending] = useActionState(rescheduleAppointmentFromForm, initialState);
  const queryClient = useQueryClient();
  const inputId = `reschedule-${appointmentId}`;

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["appointments"] }).catch(() => {
      toast.error("O atendimento foi reagendado, mas a lista não pôde ser atualizada.");
    });
  }, [state, queryClient]);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <CalendarClockIcon data-icon="inline-start" />
        Reagendar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar atendimento</DialogTitle>
          <DialogDescription>Escolha um novo horário disponível para este atendimento.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={inputId}>Nova data e horário</FieldLabel>
              <Input id={inputId} name="startTime" type="datetime-local" min={minStartTime} defaultValue={currentStartTime} required disabled={isPending} />
            </Field>
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-4">
              <AlertTitle>{state.status === "error" ? "Não foi possível reagendar" : "Atendimento reagendado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : <CalendarClockIcon data-icon="inline-start" />}
              {isPending ? "Reagendando..." : "Salvar horário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
