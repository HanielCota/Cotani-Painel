"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftIcon, CalendarIcon, CalendarPlusIcon, CheckIcon, ClockIcon, ImageIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createPublicAppointment } from "@/server/actions/public-booking";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/types";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  imageUrl: string | null;
}

interface AvailabilitySlot {
  startTime: string;
  label: string;
}

interface BookingStepsProps {
  slug: string;
  clinicName: string;
  services: Service[];
  minDate: string;
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Step = "service" | "datetime" | "customer";

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "service", label: "Serviço" },
    { id: "datetime", label: "Data e hora" },
    { id: "customer", label: "Seus dados" },
  ];

  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = step.id === current;

        return (
          <div key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isActive && !isCurrent ? <CheckIcon className="size-3.5" /> : index + 1}
            </div>
            <span className={`text-xs ${isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ServiceStep({
  services,
  selectedId,
  onSelect,
}: {
  services: Service[];
  selectedId: string;
  onSelect: (service: Service) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-primary">
        <CalendarPlusIcon className="size-5" />
        <h2 className="text-lg font-semibold">Escolha o serviço</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const selected = selectedId === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.imageUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ImageIcon className="size-6" />
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{service.name}</span>
                <span className="text-sm text-muted-foreground">{service.duration} min</span>
                <span className="text-base font-semibold text-primary">{priceFormatter.format(service.price)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateTimeStep({
  minDate,
  selectedDate,
  selectedSlot,
  slots,
  isFetching,
  onDateChange,
  onSlotChange,
}: {
  minDate: string;
  selectedDate: string;
  selectedSlot: AvailabilitySlot | null;
  slots: AvailabilitySlot[];
  isFetching: boolean;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: AvailabilitySlot) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selectedDateValue = selectedDate ? parseISO(selectedDate) : undefined;
  const minDateValue = parseISO(minDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-primary">
        <ClockIcon className="size-5" />
        <h2 className="text-lg font-semibold">Escolha data e horário</h2>
      </div>

      <Field>
        <FieldLabel htmlFor="booking-date">Data</FieldLabel>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                id="booking-date"
                variant="outline"
                className={`w-full justify-start font-normal ${selectedDateValue ? "" : "text-muted-foreground"}`}
              />
            }
          >
            <CalendarIcon aria-hidden="true" />
            {selectedDateValue ? format(selectedDateValue, "dd/MM/yyyy") : "Selecione uma data"}
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="center">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDateValue}
              onSelect={(day) => {
                if (!day) return;
                onDateChange(format(day, "yyyy-MM-dd"));
                setCalendarOpen(false);
              }}
              disabled={{ before: minDateValue }}
            />
          </PopoverContent>
        </Popover>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Horários disponíveis</legend>
        <div aria-live="polite" className="flex flex-wrap gap-2">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Selecione uma data para ver os horários.</p>
          ) : isFetching ? (
            Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-9 w-16" />)
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem horários disponíveis para esta data.</p>
          ) : (
            slots.map((slot, index) => {
              const selected = selectedSlot?.startTime === slot.startTime;

              return (
                <label key={slot.startTime} className="cursor-pointer">
                  <input
                    type="radio"
                    name="startTime"
                    value={slot.startTime}
                    required={index === 0}
                    checked={selected}
                    className="peer sr-only"
                    onChange={() => onSlotChange(slot)}
                  />
                  <span
                    className={`inline-flex h-9 items-center rounded-md border px-3 text-sm transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {slot.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </fieldset>
    </div>
  );
}

function CustomerStep({ isPending }: { isPending: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-primary">
        <UserIcon className="size-5" />
        <h2 className="text-lg font-semibold">Seus dados</h2>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="customerName">Nome completo</FieldLabel>
          <Input
            id="customerName"
            name="customerName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            disabled={isPending}
            placeholder="Ex: João Silva"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customerPhone">WhatsApp</FieldLabel>
          <Input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            required
            minLength={8}
            maxLength={32}
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            disabled={isPending}
          />
          <FieldDescription>Usado para enviar a confirmação e os lembretes.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="customerEmail">E-mail (opcional)</FieldLabel>
          <Input
            id="customerEmail"
            name="customerEmail"
            type="email"
            autoComplete="email"
            disabled={isPending}
            placeholder="seu@email.com"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Observações (opcional)</FieldLabel>
          <Textarea id="notes" name="notes" maxLength={2000} disabled={isPending} placeholder="Alguma observação para o barbeiro?" />
        </Field>
      </FieldGroup>
    </div>
  );
}

export function BookingSteps({ slug, clinicName, services, minDate }: BookingStepsProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["public-availability", slug, serviceId, date],
    queryFn: async (): Promise<{ slots: AvailabilitySlot[] }> => {
      const response = await fetch(`/api/public/${slug}/availability?serviceId=${serviceId}&date=${date}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os horários.");
      }

      return response.json();
    },
    enabled: Boolean(serviceId && date),
  });

  function handleServiceSelect(selectedService: Service) {
    setServiceId(selectedService.id);
    setServiceName(selectedService.name);
    setDate("");
    setSlot(null);
    setStep("datetime");
  }

  function handleDateChange(newDate: string) {
    setDate(newDate);
    setSlot(null);
  }

  function handleSlotChange(newSlot: AvailabilitySlot) {
    setSlot(newSlot);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;

    const formData = new FormData(event.currentTarget);
    formData.set("slug", slug);
    formData.set("serviceId", serviceId);
    formData.set("startTime", slot.startTime);

    startTransition(async () => {
      const nextResult = await createPublicAppointment({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        void refetch();
        return;
      }

      const params = new URLSearchParams();
      if (serviceName) params.set("service", serviceName);
      if (date) params.set("date", date);
      if (slot) params.set("time", slot.label);
      params.set("customer", String(formData.get("customerName")));

      router.push(`/${slug}/sucesso?${params.toString()}`);
    });
  }

  const slots = data?.slots ?? [];

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Novo agendamento</CardTitle>
        <CardDescription>Complete as etapas para reservar seu horário em {clinicName}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <StepIndicator current={step} />

        <form id="public-booking" onSubmit={handleSubmit}>
          {step === "service" ? (
            <ServiceStep services={services} selectedId={serviceId} onSelect={handleServiceSelect} />
          ) : null}

          {step === "datetime" ? (
            <DateTimeStep
              minDate={minDate}
              selectedDate={date}
              selectedSlot={slot}
              slots={slots}
              isFetching={isFetching}
              onDateChange={handleDateChange}
              onSlotChange={handleSlotChange}
            />
          ) : null}

          {step === "customer" ? <CustomerStep isPending={isPending} /> : null}

          {result?.status === "error" ? (
            <Alert variant="destructive" className="mt-5">
              <AlertTitle>Não foi possível agendar</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step !== "service" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (step === "customer") setStep("datetime");
              else if (step === "datetime") setStep("service");
            }}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar
          </Button>
        ) : (
          <div />
        )}

        {step === "datetime" ? (
          <Button
            type="button"
            disabled={!slot}
            onClick={() => setStep("customer")}
            className="w-full sm:w-auto"
          >
            Continuar
            <CheckIcon data-icon="inline-end" />
          </Button>
        ) : null}

        {step === "customer" ? (
          <Button type="submit" form="public-booking" disabled={isPending || services.length === 0} className="w-full sm:w-auto">
            {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
            {isPending ? "Agendando..." : "Confirmar agendamento"}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
