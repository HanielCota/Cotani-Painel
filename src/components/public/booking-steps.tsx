"use client";

import { useRef } from "react";
import { CheckIcon } from "lucide-react";

import { ErrorBoundary } from "@/components/error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/types";
import { BookingCustomerStep } from "./booking-customer-step";
import { BookingDateTimeStep } from "./booking-datetime-step";
import { BookingSelectionStep, BookingStepIndicator } from "./booking-selection-step";
import { BookingStepsFooter } from "./booking-steps-footer";
import type { BookingProfessional, BookingService } from "./booking-types";
import { useBookingFlow } from "./use-booking-flow";

interface BookingStepsProps {
  slug: string;
  clinicName: string;
  services: BookingService[];
  professionals: BookingProfessional[];
  minDate: string;
  rescheduleToken?: string;
  initialServiceId?: string;
  initialProfessionalId?: string;
}

type BookingFlow = ReturnType<typeof useBookingFlow>;

interface BookingStepContentProps {
  flow: BookingFlow;
  slug: string;
  clinicName: string;
  services: BookingService[];
  professionals: BookingProfessional[];
  minDate: string;
}

/** O que a reserva garante ao cliente; só fatos que valem para todo negócio. */
const BOOKING_GUARANTEES = ["Sem criar conta", "Só horários livres", "Confirmação na hora"];

function BookingGuarantees() {
  return (
    <ul aria-label="Garantias da reserva" className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
      {BOOKING_GUARANTEES.map((item) => (
        <li key={item} className="flex items-center gap-1.5">
          <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function BookingCardHeader({ clinicName, isReschedule }: { clinicName: string; isReschedule: boolean }) {
  return (
    <CardHeader className="gap-2">
      <CardTitle className="text-lg sm:text-xl">{isReschedule ? "Reagendar atendimento" : "Novo agendamento"}</CardTitle>
      <CardDescription>
        {isReschedule
          ? "Escolha o novo horário. O anterior será liberado somente após a confirmação."
          : `Complete as etapas para reservar seu horário em ${clinicName}.`}
      </CardDescription>
      {isReschedule ? null : <BookingGuarantees />}
    </CardHeader>
  );
}

function BookingStepContent({ flow, slug, clinicName, services, professionals, minDate }: BookingStepContentProps) {
  const { step, selection, derived, availability, submit } = flow;

  return (
    <>
      {step === "service-professional" ? (
        <BookingSelectionStep
          services={services}
          professionals={professionals}
          selectedServiceId={selection.serviceId}
          selectedProfessionalId={selection.professionalId}
          onServiceSelect={selection.handleServiceSelect}
          onProfessionalSelect={selection.setProfessionalId}
        />
      ) : null}
      {step === "datetime" ? (
        <BookingDateTimeStep
          minDate={minDate}
          selectedDate={selection.date}
          selectedSlot={selection.slot}
          slots={availability.slots}
          isFetching={availability.isFetchingSlots}
          availableDates={availability.availableDates}
          isLoadingAvailableDates={availability.isLoadingAvailableDates}
          onDateChange={selection.handleDateChange}
          onSlotChange={selection.setSlot}
          onMonthChange={selection.setCalendarMonth}
        />
      ) : null}
      {step === "customer" ? (
        <BookingCustomerStep
          isPending={submit.isPending}
          slug={slug}
          clinicName={clinicName}
          service={derived.selectedService}
          professional={derived.selectedProfessional}
          anyProfessional={derived.anyProfessional}
          date={selection.date}
          slot={selection.slot}
        />
      ) : null}
    </>
  );
}

function BookingErrorAlert({ result }: { result: ActionResult | null }) {
  if (result?.status !== "error") return null;

  return (
    <Alert variant="destructive" className="mt-5">
      <AlertTitle>Não foi possível agendar</AlertTitle>
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

export function BookingSteps({
  slug,
  clinicName,
  services,
  professionals,
  minDate,
  rescheduleToken,
  initialServiceId = "",
  initialProfessionalId = "",
}: BookingStepsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const flowOptions = { slug, services, professionals, minDate, rescheduleToken, initialServiceId, initialProfessionalId };
  const flow = useBookingFlow(flowOptions, cardRef);
  const isReschedule = Boolean(rescheduleToken);
  const stepContentProps = { flow, slug, clinicName, services, professionals, minDate };

  return (
    <Card ref={cardRef} className="scroll-mt-4 overflow-clip">
      <BookingCardHeader clinicName={clinicName} isReschedule={isReschedule} />
      <CardContent className="flex flex-col gap-6">
        <BookingStepIndicator current={flow.step} />
        <form id="public-booking" onSubmit={flow.submit.handleSubmit}>
          <ErrorBoundary>
            <BookingStepContent {...stepContentProps} />
          </ErrorBoundary>
          <BookingErrorAlert result={flow.submit.result} />
        </form>
      </CardContent>
      <BookingStepsFooter
        step={flow.step}
        slot={flow.selection.slot}
        serviceStepHint={flow.derived.serviceStepHint}
        canProceedFromService={flow.derived.canProceedFromService}
        isPending={flow.submit.isPending}
        hasServices={services.length > 0}
        isReschedule={isReschedule}
        onStepChange={flow.setStep}
      />
    </Card>
  );
}
