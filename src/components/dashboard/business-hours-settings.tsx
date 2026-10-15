"use client";

import { useActionState, useState } from "react";
import { ClockIcon } from "lucide-react";

import { saveBusinessHoursFromForm, saveProfessionalAvailabilityFromForm } from "@/server/actions/business-hours";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, BusinessHourItem } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const initialState: ActionResult = { status: "success", message: "" };

const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface BusinessHoursSettingsProps {
  businessHours: BusinessHourItem[];
  professionalId?: string;
}

export function BusinessHoursSettings({ businessHours, professionalId }: BusinessHoursSettingsProps) {
  const [state, formAction, isPending] = useActionState(professionalId ? saveProfessionalAvailabilityFromForm : saveBusinessHoursFromForm, initialState);
  const [localHours, setLocalHours] = useState<BusinessHourItem[]>(() => normalizeBusinessHours(businessHours));

  useActionFeedback(state);

  function toggleDay(dayOfWeek: number) {
    setLocalHours((current) =>
      current.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, isOpen: !item.isOpen } : item)),
    );
  }

  function updateField(dayOfWeek: number, field: keyof BusinessHourItem, value: string | boolean) {
    setLocalHours((current) =>
      current.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, [field]: value } : item)),
    );
  }

  function toggleBreak(dayOfWeek: number) {
    setLocalHours((current) =>
      current.map((item) => {
        if (item.dayOfWeek !== dayOfWeek) return item;

        const hasBreak = Boolean(item.breakStart && item.breakEnd);
        return {
          ...item,
          breakStart: hasBreak ? null : "12:00",
          breakEnd: hasBreak ? null : "13:00",
        };
      }),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {professionalId ? <input type="hidden" name="professionalId" value={professionalId} /> : null}
      <p className="text-sm text-muted-foreground">{professionalId ? "Os horários individuais limitam o expediente geral do negócio." : "Configure os dias e horários de funcionamento do negócio."}</p>

      <div className="overflow-hidden rounded-xl border border-border/80">
        <div className="flex flex-col divide-y">
          {[...localHours]
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((item) => (
              <div
                key={item.dayOfWeek}
                className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-start ${item.isOpen ? "" : "bg-background/60"}`}
              >
                <div className="flex min-w-[10rem] flex-col gap-3 sm:pt-6">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`isOpen-${item.dayOfWeek}`}
                      aria-label={`${item.isOpen ? "Fechar" : "Abrir"} ${weekdayLabels[item.dayOfWeek]}`}
                      name={`isOpen-${item.dayOfWeek}`}
                      checked={item.isOpen}
                      onCheckedChange={() => toggleDay(item.dayOfWeek)}
                      value="on"
                      uncheckedValue="off"
                    />
                    <label htmlFor={`isOpen-${item.dayOfWeek}`} className={`cursor-pointer text-sm font-medium ${item.isOpen ? "" : "text-muted-foreground"}`}>
                      {weekdayLabels[item.dayOfWeek]}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <Checkbox
                      id={`noBreak-${item.dayOfWeek}`}
                      checked={!item.breakStart && !item.breakEnd}
                      onCheckedChange={() => toggleBreak(item.dayOfWeek)}
                      disabled={!item.isOpen || isPending}
                    />
                    <label htmlFor={`noBreak-${item.dayOfWeek}`} className="cursor-pointer text-xs text-muted-foreground">
                      Sem intervalo{" "}<span className="sr-only">em {weekdayLabels[item.dayOfWeek]}</span>
                    </label>
                  </div>
                </div>

                <FieldGroup className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field className="min-w-0">
                    <FieldLabel htmlFor={`openTime-${item.dayOfWeek}`} className="text-xs">
                      Abertura
                    </FieldLabel>
                    <Input
                      id={`openTime-${item.dayOfWeek}`}
                      name={`openTime-${item.dayOfWeek}`}
                      type="time"
                      value={item.openTime}
                      onChange={(event) => updateField(item.dayOfWeek, "openTime", event.target.value)}
                      disabled={!item.isOpen || isPending}
                      required
                      className="w-full min-w-0"
                    />
                  </Field>
                  <Field className="min-w-0">
                    <FieldLabel htmlFor={`closeTime-${item.dayOfWeek}`} className="text-xs">
                      Fechamento
                    </FieldLabel>
                    <Input
                      id={`closeTime-${item.dayOfWeek}`}
                      name={`closeTime-${item.dayOfWeek}`}
                      type="time"
                      value={item.closeTime}
                      onChange={(event) => updateField(item.dayOfWeek, "closeTime", event.target.value)}
                      disabled={!item.isOpen || isPending}
                      required
                      className="w-full min-w-0"
                    />
                  </Field>
                  <Field className="min-w-0">
                    <FieldLabel htmlFor={`breakStart-${item.dayOfWeek}`} className="text-xs">
                      Início do intervalo
                    </FieldLabel>
                    <Input
                      id={`breakStart-${item.dayOfWeek}`}
                      name={`breakStart-${item.dayOfWeek}`}
                      type="time"
                      value={item.breakStart ?? ""}
                      onChange={(event) => updateField(item.dayOfWeek, "breakStart", event.target.value)}
                      disabled={!item.isOpen || !item.breakStart || !item.breakEnd || isPending}
                      className="w-full min-w-0"
                    />
                  </Field>
                  <Field className="min-w-0">
                    <FieldLabel htmlFor={`breakEnd-${item.dayOfWeek}`} className="text-xs">
                      Fim do intervalo
                    </FieldLabel>
                    <Input
                      id={`breakEnd-${item.dayOfWeek}`}
                      name={`breakEnd-${item.dayOfWeek}`}
                      type="time"
                      value={item.breakEnd ?? ""}
                      onChange={(event) => updateField(item.dayOfWeek, "breakEnd", event.target.value)}
                      disabled={!item.isOpen || !item.breakStart || !item.breakEnd || isPending}
                      className="w-full min-w-0"
                    />
                  </Field>
                </FieldGroup>
              </div>
            ))}
        </div>
      </div>

      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertTitle>{state.status === "error" ? "Não foi possível salvar" : "Expediente salvo"}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Spinner data-icon="inline-start" /> : <ClockIcon data-icon="inline-start" />}
          {isPending ? "Salvando..." : "Salvar expediente"}
        </Button>
      </div>
    </form>
  );
}

function normalizeBusinessHours(hours: BusinessHourItem[]): BusinessHourItem[] {
  const defaults = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    id: "",
    dayOfWeek,
    isOpen: true,
    openTime: "08:00",
    closeTime: "18:00",
    breakStart: "12:00" as string | null,
    breakEnd: "13:00" as string | null,
  }));

  const byDay = new Map(hours.map((item) => [item.dayOfWeek, item]));

  return defaults.map((defaultItem) => {
    const existing = byDay.get(defaultItem.dayOfWeek);
    if (!existing) return defaultItem;

    const hasLegacyZeroLengthBreak = Boolean(existing.breakStart && existing.breakStart === existing.breakEnd);
    return {
      ...existing,
      breakStart: hasLegacyZeroLengthBreak ? null : (existing.breakStart ?? null),
      breakEnd: hasLegacyZeroLengthBreak ? null : (existing.breakEnd ?? null),
    };
  });
}
