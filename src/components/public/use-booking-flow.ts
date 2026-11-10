import { useEffect, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { ANY_PROFESSIONAL_ID } from "@/config/booking";
import { createPublicAppointment } from "@/server/actions/public-booking";
import type { ActionResult } from "@/types";
import { getCustomerStorageKey } from "./booking-customer-step";
import type { AvailabilitySlot, BookingProfessional, BookingService, BookingStep } from "./booking-types";

interface BookingFlowOptions {
  slug: string;
  services: BookingService[];
  professionals: BookingProfessional[];
  minDate: string;
  rescheduleToken?: string;
  initialServiceId: string;
  initialProfessionalId: string;
}

interface AvailabilityOptions {
  slug: string;
  serviceId: string;
  professionalId: string;
  date: string;
  calendarMonth: Date;
  hasProfessionals: boolean;
}

interface BookingSubmitOptions {
  slug: string;
  rescheduleToken?: string;
  serviceId: string;
  professionalId: string;
  date: string;
  slot: AvailabilitySlot | null;
  selectedService?: BookingService;
  selectedProfessional?: BookingProfessional;
  refetchAvailability: () => unknown;
}

interface SuccessDetails {
  slug: string;
  date: string;
  slot: AvailabilitySlot;
  selectedService?: BookingService;
  professionalName?: string;
}

function getProfessionalsForService(professionals: BookingProfessional[], serviceId: string) {
  return professionals.filter((professional) => professional.serviceIds.includes(serviceId));
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Explica por que "Continuar" está desabilitado (no mobile o botão fica fixo no rodapé). */
function getServiceStepHint(serviceId: string, canProceedFromService: boolean) {
  if (!serviceId) return "Escolha um serviço para continuar.";
  if (!canProceedFromService) return "Escolha um profissional para continuar.";
  return null;
}

function deriveBookingSelection(
  services: BookingService[],
  professionals: BookingProfessional[],
  serviceId: string,
  professionalId: string,
) {
  const selectedService = services.find((service) => service.id === serviceId);
  const selectedProfessional = professionals.find((professional) => professional.id === professionalId);
  const availableProfessionals = selectedService ? getProfessionalsForService(professionals, selectedService.id) : [];
  const hasProfessionals = availableProfessionals.length > 0;
  const canProceedFromService = Boolean(serviceId && (!hasProfessionals || professionalId));

  return {
    selectedService,
    selectedProfessional,
    anyProfessional: professionalId === ANY_PROFESSIONAL_ID,
    hasProfessionals,
    canProceedFromService,
    serviceStepHint: getServiceStepHint(serviceId, canProceedFromService),
  };
}

async function fetchPublicJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(errorMessage);
  return response.json();
}

function buildPublicApiUrl(slug: string, endpoint: string, params: Record<string, string>, professionalId: string) {
  const searchParams = new URLSearchParams(params);
  if (professionalId) searchParams.set("professionalId", professionalId);
  return `/api/public/${slug}/${endpoint}?${searchParams.toString()}`;
}

function rememberCustomerName(slug: string, formData: FormData) {
  try {
    sessionStorage.setItem(getCustomerStorageKey(slug), JSON.stringify({ name: String(formData.get("customerName")) }));
  } catch {
    // O navegador pode bloquear o armazenamento da sessão.
  }
}

function buildSuccessUrl({ slug, date, slot, selectedService, professionalName }: SuccessDetails) {
  const params = new URLSearchParams();
  if (selectedService?.name) params.set("service", selectedService.name);
  if (selectedService?.duration) params.set("duration", String(selectedService.duration));
  if (professionalName) params.set("professional", professionalName);
  if (date) params.set("date", date);
  params.set("time", slot.label);
  return `/${slug}/sucesso?${params.toString()}`;
}

function buildBookingFormData(form: HTMLFormElement, options: BookingSubmitOptions, slot: AvailabilitySlot) {
  const formData = new FormData(form);
  formData.set("slug", options.slug);
  formData.set("serviceId", options.serviceId);
  formData.set("professionalId", options.professionalId);
  formData.set("startTime", slot.startTime);
  if (options.rescheduleToken) formData.set("rescheduleToken", options.rescheduleToken);
  return formData;
}

/** Rola até o card só ao trocar de etapa; no carregamento isso escondia o cabeçalho da loja. */
function useScrollToCardOnStepChange(step: BookingStep, cardRef: RefObject<HTMLDivElement | null>) {
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    cardRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [step, cardRef]);
}

function useBookingSelectionState({ professionals, minDate, initialServiceId, initialProfessionalId }: BookingFlowOptions) {
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [professionalId, setProfessionalId] = useState(initialProfessionalId);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => parseISO(minDate));

  function handleServiceSelect(service: BookingService) {
    const serviceProfessionals = getProfessionalsForService(professionals, service.id);
    setServiceId(service.id);
    setProfessionalId(serviceProfessionals.length === 1 ? serviceProfessionals[0].id : "");
    setDate("");
    setSlot(null);
  }

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    setSlot(null);
  }

  return {
    serviceId,
    professionalId,
    date,
    slot,
    calendarMonth,
    setProfessionalId,
    setSlot,
    setCalendarMonth,
    handleServiceSelect,
    handleDateChange,
  };
}

function useBookingAvailability(options: AvailabilityOptions) {
  const { slug, serviceId, professionalId, date, calendarMonth, hasProfessionals } = options;
  const hasProfessionalChoice = !hasProfessionals || Boolean(professionalId);
  const yearMonth = format(calendarMonth, "yyyy-MM");

  const slotsQuery = useQuery({
    queryKey: ["public-availability", slug, serviceId, professionalId, date],
    queryFn: () =>
      fetchPublicJson<{ slots: AvailabilitySlot[] }>(
        buildPublicApiUrl(slug, "availability", { serviceId, date }, professionalId),
        "Não foi possível carregar os horários.",
      ),
    enabled: Boolean(serviceId && date && hasProfessionalChoice),
  });

  const datesQuery = useQuery({
    queryKey: ["public-available-dates", slug, serviceId, professionalId, yearMonth],
    queryFn: () =>
      fetchPublicJson<{ dates: string[] }>(
        buildPublicApiUrl(slug, "available-dates", { serviceId, yearMonth }, professionalId),
        "Não foi possível carregar os dias disponíveis.",
      ),
    enabled: Boolean(serviceId && yearMonth && hasProfessionalChoice),
  });

  return {
    slots: slotsQuery.data?.slots ?? [],
    isFetchingSlots: slotsQuery.isFetching,
    refetchSlots: slotsQuery.refetch,
    availableDates: new Set(datesQuery.data?.dates ?? []),
    isLoadingAvailableDates: datesQuery.isFetching,
  };
}

function useBookingSubmit(options: BookingSubmitOptions) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slot = options.slot;
    if (!slot) return;
    const formData = buildBookingFormData(event.currentTarget, options, slot);

    startTransition(async () => {
      const nextResult = await createPublicAppointment({ status: "success", message: "" }, formData);
      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        void options.refetchAvailability();
        return;
      }

      rememberCustomerName(options.slug, formData);
      // Em "sem preferência", o servidor informa quem ficou com o atendimento.
      const professionalName = nextResult.professionalName ?? options.selectedProfessional?.name;
      const successUrl = buildSuccessUrl({
        slug: options.slug,
        date: options.date,
        slot,
        selectedService: options.selectedService,
        professionalName,
      });
      router.push(successUrl);
    });
  }

  return { result, isPending, handleSubmit };
}

export function useBookingFlow(options: BookingFlowOptions, cardRef: RefObject<HTMLDivElement | null>) {
  const [step, setStep] = useState<BookingStep>("service-professional");
  const selection = useBookingSelectionState(options);
  useScrollToCardOnStepChange(step, cardRef);

  const derived = deriveBookingSelection(options.services, options.professionals, selection.serviceId, selection.professionalId);
  const availability = useBookingAvailability({
    slug: options.slug,
    serviceId: selection.serviceId,
    professionalId: selection.professionalId,
    date: selection.date,
    calendarMonth: selection.calendarMonth,
    hasProfessionals: derived.hasProfessionals,
  });
  const submit = useBookingSubmit({
    slug: options.slug,
    rescheduleToken: options.rescheduleToken,
    serviceId: selection.serviceId,
    professionalId: selection.professionalId,
    date: selection.date,
    slot: selection.slot,
    selectedService: derived.selectedService,
    selectedProfessional: derived.selectedProfessional,
    refetchAvailability: availability.refetchSlots,
  });

  return { step, setStep, selection, derived, availability, submit };
}
