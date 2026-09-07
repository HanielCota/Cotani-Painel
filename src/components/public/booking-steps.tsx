"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeftIcon, ArrowRightIcon, CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { createPublicAppointment } from "@/server/actions/public-booking";
import type { ActionResult } from "@/types";
import { BookingCustomerStep, getCustomerStorageKey } from "./booking-customer-step";
import { BookingDateTimeStep } from "./booking-datetime-step";
import { BookingSelectionStep, BookingStepIndicator } from "./booking-selection-step";
import type { AvailabilitySlot, BookingProfessional, BookingService, BookingStep } from "./booking-types";

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

export function BookingSteps({ slug, clinicName, services, professionals, minDate, rescheduleToken, initialServiceId = "", initialProfessionalId = "" }: BookingStepsProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<BookingStep>("service-professional");
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [professionalId, setProfessionalId] = useState(initialProfessionalId);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => parseISO(minDate));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [step]);

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedProfessional = professionals.find((professional) => professional.id === professionalId);
  const availableProfessionals = selectedService ? professionals.filter((professional) => professional.serviceIds.includes(selectedService.id)) : [];
  const hasProfessionals = availableProfessionals.length > 0;
  const canProceedFromService = Boolean(serviceId && (!hasProfessionals || professionalId));

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["public-availability", slug, serviceId, professionalId, date],
    queryFn: async (): Promise<{ slots: AvailabilitySlot[] }> => {
      const searchParams = new URLSearchParams({ serviceId, date });
      if (professionalId) searchParams.set("professionalId", professionalId);
      const response = await fetch(`/api/public/${slug}/availability?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Não foi possível carregar os horários.");
      return response.json();
    },
    enabled: Boolean(serviceId && date && (!hasProfessionals || professionalId)),
  });

  const yearMonth = format(calendarMonth, "yyyy-MM");
  const { data: availableDatesData, isFetching: isLoadingAvailableDates } = useQuery({
    queryKey: ["public-available-dates", slug, serviceId, professionalId, yearMonth],
    queryFn: async (): Promise<{ dates: string[] }> => {
      const searchParams = new URLSearchParams({ serviceId, yearMonth });
      if (professionalId) searchParams.set("professionalId", professionalId);
      const response = await fetch(`/api/public/${slug}/available-dates?${searchParams.toString()}`);
      if (!response.ok) throw new Error("Não foi possível carregar os dias disponíveis.");
      return response.json();
    },
    enabled: Boolean(serviceId && yearMonth && (!hasProfessionals || professionalId)),
  });

  function handleServiceSelect(service: BookingService) {
    const serviceProfessionals = professionals.filter((professional) => professional.serviceIds.includes(service.id));
    setServiceId(service.id);
    setProfessionalId(serviceProfessionals.length === 1 ? serviceProfessionals[0].id : "");
    setDate("");
    setSlot(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;
    const formData = new FormData(event.currentTarget);
    formData.set("slug", slug);
    formData.set("serviceId", serviceId);
    formData.set("professionalId", professionalId);
    formData.set("startTime", slot.startTime);
    if (rescheduleToken) formData.set("rescheduleToken", rescheduleToken);

    startTransition(async () => {
      const nextResult = await createPublicAppointment({ status: "success", message: "" }, formData);
      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        void refetch();
        return;
      }
      try {
        sessionStorage.setItem(getCustomerStorageKey(slug), JSON.stringify({ name: String(formData.get("customerName")) }));
      } catch {
        // O navegador pode bloquear o armazenamento da sessão.
      }
      const params = new URLSearchParams();
      if (selectedService?.name) params.set("service", selectedService.name);
      if (selectedService?.duration) params.set("duration", String(selectedService.duration));
      if (selectedProfessional?.name) params.set("professional", selectedProfessional.name);
      if (date) params.set("date", date);
      params.set("time", slot.label);
      router.push(`/${slug}/sucesso?${params.toString()}`);
    });
  }

  return (
    <Card ref={cardRef} className="overflow-hidden">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg sm:text-xl">{rescheduleToken ? "Reagendar atendimento" : "Novo agendamento"}</CardTitle>
        <CardDescription>{rescheduleToken ? "Escolha o novo horário. O anterior será liberado somente após a confirmação." : `Complete as etapas para reservar seu horário em ${clinicName}.`}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <BookingStepIndicator current={step} />
        <form id="public-booking" onSubmit={handleSubmit}>
          <ErrorBoundary>
            {step === "service-professional" ? <BookingSelectionStep services={services} professionals={professionals} selectedServiceId={serviceId} selectedProfessionalId={professionalId} onServiceSelect={handleServiceSelect} onProfessionalSelect={(professional) => setProfessionalId(professional.id)} /> : null}
            {step === "datetime" ? <BookingDateTimeStep minDate={minDate} selectedDate={date} selectedSlot={slot} slots={data?.slots ?? []} isFetching={isFetching} availableDates={new Set(availableDatesData?.dates ?? [])} isLoadingAvailableDates={isLoadingAvailableDates} onDateChange={(nextDate) => { setDate(nextDate); setSlot(null); }} onSlotChange={setSlot} onMonthChange={setCalendarMonth} /> : null}
            {step === "customer" ? <BookingCustomerStep isPending={isPending} slug={slug} clinicName={clinicName} service={selectedService} professional={selectedProfessional} date={date} slot={slot} /> : null}
          </ErrorBoundary>
          {result?.status === "error" ? <Alert variant="destructive" className="mt-5"><AlertTitle>Não foi possível agendar</AlertTitle><AlertDescription>{result.message}</AlertDescription></Alert> : null}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
        {step !== "service-professional" ? <Button type="button" variant="outline" onClick={() => setStep(step === "customer" ? "datetime" : "service-professional")} disabled={isPending} className="h-12 w-full sm:w-auto"><ArrowLeftIcon data-icon="inline-start" />Voltar</Button> : <div className="hidden sm:block" />}
        {step === "service-professional" ? <Button type="button" disabled={!canProceedFromService} onClick={() => setStep("datetime")} className="h-12 w-full sm:w-auto">Continuar<ArrowRightIcon data-icon="inline-end" /></Button> : null}
        {step === "datetime" ? <Button type="button" disabled={!slot} onClick={() => setStep("customer")} className="h-12 w-full sm:w-auto">Continuar<ArrowRightIcon data-icon="inline-end" /></Button> : null}
        {step === "customer" ? <Button type="submit" form="public-booking" disabled={isPending || services.length === 0} className="h-12 w-full sm:w-auto">{isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}{isPending ? "Salvando..." : rescheduleToken ? "Confirmar novo horário" : "Confirmar agendamento"}</Button> : null}
      </CardFooter>
    </Card>
  );
}
