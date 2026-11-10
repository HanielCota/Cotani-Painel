"use client";

import { ArrowLeftIcon, ArrowRightIcon, CalendarPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { AvailabilitySlot, BookingStep } from "./booking-types";

interface BookingStepsFooterProps {
  step: BookingStep;
  slot: AvailabilitySlot | null;
  serviceStepHint: string | null;
  canProceedFromService: boolean;
  isPending: boolean;
  hasServices: boolean;
  isReschedule: boolean;
  onStepChange: (step: BookingStep) => void;
}

const FOOTER_CLASS_NAME =
  "sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border/70 bg-card/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:static sm:flex-row sm:justify-between sm:border-0 sm:bg-card sm:pt-2 sm:backdrop-blur-none";

function getSubmitLabel(isPending: boolean, isReschedule: boolean) {
  if (isPending) return "Salvando...";
  if (isReschedule) return "Confirmar novo horário";
  return "Confirmar agendamento";
}

function MobileHint({ children }: { children: string }) {
  return <p className="text-center text-xs text-muted-foreground sm:hidden">{children}</p>;
}

function BackButton({ step, isPending, onStepChange }: Pick<BookingStepsFooterProps, "step" | "isPending" | "onStepChange">) {
  if (step === "service-professional") return <div className="hidden sm:block" />;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onStepChange(step === "customer" ? "datetime" : "service-professional")}
      disabled={isPending}
      className="h-12 w-full sm:w-auto"
    >
      <ArrowLeftIcon data-icon="inline-start" />
      Voltar
    </Button>
  );
}

function ContinueButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" disabled={disabled} onClick={onClick} className="h-12 w-full sm:w-auto">
      Continuar
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );
}

function SubmitBookingButton({ isPending, hasServices, isReschedule }: Pick<BookingStepsFooterProps, "isPending" | "hasServices" | "isReschedule">) {
  return (
    <Button type="submit" form="public-booking" disabled={isPending || !hasServices} className="h-12 w-full sm:w-auto">
      {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
      {getSubmitLabel(isPending, isReschedule)}
    </Button>
  );
}

export function BookingStepsFooter(props: BookingStepsFooterProps) {
  const { step, slot, serviceStepHint, canProceedFromService, onStepChange } = props;

  return (
    <CardFooter className={FOOTER_CLASS_NAME}>
      {step === "service-professional" && serviceStepHint ? <MobileHint>{serviceStepHint}</MobileHint> : null}
      {step === "datetime" && !slot ? <MobileHint>Escolha um dia e um horário.</MobileHint> : null}
      <BackButton step={step} isPending={props.isPending} onStepChange={onStepChange} />
      {step === "service-professional" ? (
        <ContinueButton disabled={!canProceedFromService} onClick={() => onStepChange("datetime")} />
      ) : null}
      {step === "datetime" ? <ContinueButton disabled={!slot} onClick={() => onStepChange("customer")} /> : null}
      {step === "customer" ? (
        <SubmitBookingButton isPending={props.isPending} hasServices={props.hasServices} isReschedule={props.isReschedule} />
      ) : null}
    </CardFooter>
  );
}
