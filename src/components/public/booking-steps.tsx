"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftIcon, CalendarIcon, CalendarPlusIcon, CheckIcon, ClockIcon, ImageIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createPublicAppointment } from "@/server/actions/public-booking";
import { ErrorBoundary } from "@/components/error-boundary";
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

interface Professional {
  id: string;
  name: string;
  imageUrl: string | null;
  serviceIds: string[];
}

interface AvailabilitySlot {
  startTime: string;
  label: string;
}

interface BookingStepsProps {
  slug: string;
  clinicName: string;
  services: Service[];
  professionals: Professional[];
  minDate: string;
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Step = "service-professional" | "datetime" | "customer";

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "service-professional", label: "Serviço" },
    { id: "datetime", label: "Data e hora" },
    { id: "customer", label: "Seus dados" },
  ];

  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Progresso do agendamento" className="flex w-full min-w-0 items-center gap-2 sm:justify-between">
      {steps.map((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = step.id === current;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                isCurrent
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                  : isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isActive && !isCurrent ? <CheckIcon className="size-4" /> : index + 1}
            </div>
            <span
              className={`truncate px-1 text-center text-[11px] sm:text-xs ${
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

function ServiceProfessionalStep({
  services,
  professionals,
  selectedServiceId,
  selectedProfessionalId,
  onServiceSelect,
  onProfessionalSelect,
}: {
  services: Service[];
  professionals: Professional[];
  selectedServiceId: string;
  selectedProfessionalId: string;
  onServiceSelect: (service: Service) => void;
  onProfessionalSelect: (professional: Professional) => void;
}) {
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const availableProfessionals = selectedService
    ? professionals.filter((professional) => professional.serviceIds.includes(selectedService.id))
    : [];

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div className="flex items-center gap-2 text-primary">
        <CalendarPlusIcon className="size-5" />
        <h2 className="text-lg font-semibold">Escolha o serviço e o profissional</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const selected = selectedServiceId === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onServiceSelect(service)}
              className={`flex min-h-[5.5rem] min-w-0 items-center gap-4 overflow-hidden rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
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
                  className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-border sm:size-16"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-16">
                  <ImageIcon className="size-6" />
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                <span className="truncate font-semibold leading-tight">{service.name}</span>
                <span className="text-sm text-muted-foreground">{service.duration} min</span>
                <span className="text-base font-bold text-primary">{priceFormatter.format(service.price)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedService ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary">
            <UserIcon className="size-5" />
            <h3 className="text-base font-semibold">Profissional para {selectedService.name}</h3>
          </div>

          {availableProfessionals.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background/50 p-6 text-center">
              <UserIcon className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">Nenhum profissional disponível</p>
              <p className="text-sm text-muted-foreground">
                Não há profissionais vinculados a este serviço no momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableProfessionals.map((professional) => {
                const selected = selectedProfessionalId === professional.id;

                return (
                  <button
                    key={professional.id}
                    type="button"
                    onClick={() => onProfessionalSelect(professional)}
                    className={`flex min-h-[4.5rem] min-w-0 items-center gap-4 overflow-hidden rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {professional.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={professional.imageUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border sm:size-14"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-14">
                        <UserIcon className="size-5 sm:size-6" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate font-semibold leading-tight">{professional.name}</span>
                      <span className="text-sm text-muted-foreground">Profissional</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DateTimeStep({
  minDate,
  selectedDate,
  selectedSlot,
  slots,
  isFetching,
  availableDates,
  isLoadingAvailableDates,
  onDateChange,
  onSlotChange,
  onMonthChange,
}: {
  minDate: string;
  selectedDate: string;
  selectedSlot: AvailabilitySlot | null;
  slots: AvailabilitySlot[];
  isFetching: boolean;
  availableDates: Set<string>;
  isLoadingAvailableDates: boolean;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: AvailabilitySlot) => void;
  onMonthChange: (month: Date) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selectedDateValue = selectedDate ? parseISO(selectedDate) : undefined;
  const minDateValue = parseISO(minDate);

  const isDateDisabled = (day: Date) => {
    const dayString = format(day, "yyyy-MM-dd");
    return day < minDateValue || !availableDates.has(dayString);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
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
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden p-0" align="center">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDateValue}
              onSelect={(day) => {
                if (!day) return;
                onDateChange(format(day, "yyyy-MM-dd"));
                setCalendarOpen(false);
              }}
              onMonthChange={(month) => {
                onMonthChange(month);
              }}
              disabled={isDateDisabled}
            />
            {isLoadingAvailableDates ? (
              <p className="px-4 py-2 text-xs text-muted-foreground">Carregando dias disponíveis...</p>
            ) : null}
          </PopoverContent>
        </Popover>
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Horários disponíveis</legend>
        <div aria-live="polite" className="flex flex-wrap gap-2.5">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Selecione uma data para ver os horários.</p>
          ) : isFetching ? (
            <div className="flex w-full flex-wrap gap-2.5">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-20 rounded-lg" />
              ))}
            </div>
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
                    className={`inline-flex min-h-12 items-center rounded-lg border px-5 text-sm font-medium transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring active:scale-95 ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {slot.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {selectedDate && !isFetching && slots.length > 0 && slots.length <= 3 ? (
          <p className="text-xs font-medium text-amber-600">
            Apenas {slots.length} {slots.length === 1 ? "horário disponível" : "horários disponíveis"} para este dia.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

interface BookingSummaryProps {
  clinicName: string;
  service: Service | undefined;
  professional: Professional | undefined;
  date: string;
  slot: AvailabilitySlot | null;
}

function BookingSummary({ clinicName, service, professional, date, slot }: BookingSummaryProps) {
  const formattedDate = date
    ? format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="rounded-xl border bg-background/60 p-4 text-sm">
      <h3 className="mb-3 font-semibold">Resumo do agendamento</h3>
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Barbearia</dt>
          <dd className="font-medium">{clinicName}</dd>
        </div>
        {service ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Serviço</dt>
            <dd className="font-medium">{service.name}</dd>
          </div>
        ) : null}
        {professional ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Profissional</dt>
            <dd className="font-medium">{professional.name}</dd>
          </div>
        ) : null}
        {formattedDate ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Data</dt>
            <dd className="font-medium">{formattedDate}</dd>
          </div>
        ) : null}
        {slot ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Horário</dt>
            <dd className="font-medium">{slot.label}</dd>
          </div>
        ) : null}
        {service ? (
          <div className="flex justify-between gap-4 border-t pt-2">
            <dt className="text-muted-foreground">Valor estimado</dt>
            <dd className="font-bold text-primary">{priceFormatter.format(service.price)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

interface CustomerStepProps {
  isPending: boolean;
  slug: string;
  clinicName: string;
  service: Service | undefined;
  professional: Professional | undefined;
  date: string;
  slot: AvailabilitySlot | null;
}

function getCustomerStorageKey(slug: string): string {
  return `cotani:customer:${slug}`;
}

function readSavedCustomer(slug: string): { name?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(getCustomerStorageKey(slug));
    if (!raw) return {};
    return JSON.parse(raw) as { name?: string };
  } catch {
    return {};
  }
}

function CustomerStep({ isPending, slug, clinicName, service, professional, date, slot }: CustomerStepProps) {
  const savedCustomer = readSavedCustomer(slug);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);

  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const masked = formatPhone(event.target.value);
    setPhone(masked);
    setPhoneError(false);
  }

  function handlePhoneBlur() {
    if (phone && !isValidPhone(phone)) {
      setPhoneError(true);
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="flex items-center gap-2 text-primary">
        <UserIcon className="size-5" />
        <h2 className="text-lg font-semibold">Seus dados</h2>
      </div>

      <BookingSummary
        clinicName={clinicName}
        service={service}
        professional={professional}
        date={date}
        slot={slot}
      />

      <FieldGroup className="gap-4">
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
            placeholder="Seu nome completo"
            defaultValue={savedCustomer.name}
            className="h-12"
          />
        </Field>
        <Field data-invalid={phoneError || undefined}>
          <FieldLabel htmlFor="customerPhone">WhatsApp</FieldLabel>
          <Input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            required
            minLength={14}
            maxLength={16}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            disabled={isPending}
            value={phone}
            onChange={handlePhoneChange}
            onBlur={handlePhoneBlur}
            className="h-12"
          />
          <FieldDescription>Usado pela barbearia para identificar e entrar em contato com você.</FieldDescription>
          {phoneError ? (
            <p className="text-xs text-destructive">Informe um WhatsApp válido com DDD.</p>
          ) : null}
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
            className="h-12"
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

export function BookingSteps({ slug, clinicName, services, professionals, minDate }: BookingStepsProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("service-professional");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [professionalName, setProfessionalName] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => parseISO(minDate));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

  const selectedService = services.find((service) => service.id === serviceId);
  const availableProfessionals = selectedService
    ? professionals.filter((professional) => professional.serviceIds.includes(selectedService.id))
    : [];
  const hasProfessionals = availableProfessionals.length > 0;
  const canProceedFromService = serviceId && (!hasProfessionals || professionalId);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["public-availability", slug, serviceId, professionalId, date],
    queryFn: async (): Promise<{ slots: AvailabilitySlot[] }> => {
      const searchParams = new URLSearchParams({ serviceId, date });
      if (professionalId) searchParams.set("professionalId", professionalId);
      const response = await fetch(`/api/public/${slug}/availability?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os horários.");
      }

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

      if (!response.ok) {
        throw new Error("Não foi possível carregar os dias disponíveis.");
      }

      return response.json();
    },
    enabled: Boolean(serviceId && yearMonth && (!hasProfessionals || professionalId)),
  });

  const availableDates = new Set(availableDatesData?.dates ?? []);

  function handleServiceSelect(selectedService: Service) {
    const serviceProfessionals = professionals.filter((professional) =>
      professional.serviceIds.includes(selectedService.id),
    );

    setServiceId(selectedService.id);
    setServiceName(selectedService.name);
    setProfessionalId("");
    setProfessionalName("");
    setDate("");
    setSlot(null);

    if (serviceProfessionals.length === 1) {
      setProfessionalId(serviceProfessionals[0].id);
      setProfessionalName(serviceProfessionals[0].name);
    }
  }

  function handleProfessionalSelect(selectedProfessional: Professional) {
    setProfessionalId(selectedProfessional.id);
    setProfessionalName(selectedProfessional.name);
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
    formData.set("professionalId", professionalId);
    formData.set("startTime", slot.startTime);

    startTransition(async () => {
      const nextResult = await createPublicAppointment({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        void refetch();
        return;
      }

      const customerName = String(formData.get("customerName"));
      try {
        sessionStorage.setItem(
          getCustomerStorageKey(slug),
          JSON.stringify({ name: customerName }),
        );
      } catch {
        // Ignora erros de escrita no localStorage.
      }

      const params = new URLSearchParams();
      if (serviceName) params.set("service", serviceName);
      if (professionalName) params.set("professional", professionalName);
      if (date) params.set("date", date);
      if (slot) params.set("time", slot.label);
      router.push(`/${slug}/sucesso?${params.toString()}`);
    });
  }

  const slots = data?.slots ?? [];

  return (
    <Card ref={cardRef} className="overflow-hidden">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg sm:text-xl">Novo agendamento</CardTitle>
        <CardDescription>Complete as etapas para reservar seu horário em {clinicName}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <StepIndicator current={step} />

        <form id="public-booking" onSubmit={handleSubmit}>
          <ErrorBoundary>
            {step === "service-professional" ? (
              <ServiceProfessionalStep
                services={services}
                professionals={professionals}
                selectedServiceId={serviceId}
                selectedProfessionalId={professionalId}
                onServiceSelect={handleServiceSelect}
                onProfessionalSelect={handleProfessionalSelect}
              />
            ) : null}

            {step === "datetime" ? (
              <DateTimeStep
                minDate={minDate}
                selectedDate={date}
                selectedSlot={slot}
                slots={slots}
                isFetching={isFetching}
                availableDates={availableDates}
                isLoadingAvailableDates={isLoadingAvailableDates}
                onDateChange={handleDateChange}
                onSlotChange={handleSlotChange}
                onMonthChange={setCalendarMonth}
              />
            ) : null}

            {step === "customer" ? (
              <CustomerStep
                isPending={isPending}
                slug={slug}
                clinicName={clinicName}
                service={selectedService}
                professional={professionals.find((professional) => professional.id === professionalId)}
                date={date}
                slot={slot}
              />
            ) : null}
          </ErrorBoundary>

          {result?.status === "error" ? (
            <Alert variant="destructive" className="mt-5">
              <AlertTitle>Não foi possível agendar</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
        {step !== "service-professional" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (step === "customer") setStep("datetime");
              else if (step === "datetime") setStep("service-professional");
            }}
            disabled={isPending}
            className="h-12 w-full sm:w-auto"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}

        {step === "service-professional" ? (
          <Button
            type="button"
            disabled={!canProceedFromService}
            onClick={() => setStep("datetime")}
            className="h-12 w-full sm:w-auto"
          >
            Continuar
            <CheckIcon data-icon="inline-end" />
          </Button>
        ) : null}

        {step === "datetime" ? (
          <Button
            type="button"
            disabled={!slot}
            onClick={() => setStep("customer")}
            className="h-12 w-full sm:w-auto"
          >
            Continuar
            <CheckIcon data-icon="inline-end" />
          </Button>
        ) : null}

        {step === "customer" ? (
          <Button
            type="submit"
            form="public-booking"
            disabled={isPending || services.length === 0}
            className="h-12 w-full sm:w-auto"
          >
            {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
            {isPending ? "Agendando..." : "Confirmar agendamento"}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
