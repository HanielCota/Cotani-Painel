"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheckIcon, CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createPublicAppointment } from "@/server/actions/public-booking";
import type { ActionResult } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

interface AvailabilitySlot {
  startTime: string;
  label: string;
}

interface PublicBookingFormProps {
  slug: string;
  clinicName: string;
  timeZone: string;
  minDate: string;
  services: Array<{ id: string; name: string; duration: number; price: number }>;
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PublicBookingForm({ slug, clinicName, minDate, services }: PublicBookingFormProps) {
  const [state, formAction, isPending] = useActionState(createPublicAppointment, initialState);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slotLabel, setSlotLabel] = useState("");

  // Sucesso é derivado do estado da action (sem setState em efeito).
  const completed = state.status === "success" && Boolean(state.message);

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

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
      // Em caso de conflito (ou qualquer erro), os slots podem ter mudado.
      void refetch();
    }
  }, [state, refetch]);

  if (completed) {
    const serviceName = services.find((service) => service.id === serviceId)?.name;

    return (
      <Card className="border border-border/80 shadow-sm" role="status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheckIcon aria-hidden="true" />
            Agendamento confirmado
          </CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Clínica</dt>
              <dd className="font-medium">{clinicName}</dd>
            </div>
            {serviceName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Serviço</dt>
                <dd className="font-medium">{serviceName}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Data</dt>
              <dd className="font-medium">{date}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Horário</dt>
              <dd className="font-medium">{slotLabel}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Fazer outro agendamento
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const slots = data?.slots ?? [];

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Novo agendamento</CardTitle>
        <CardDescription>Escolha o serviço, a data e um horário disponível.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="public-booking" action={formAction}>
          <input type="hidden" name="slug" value={slug} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="serviceId">Serviço</FieldLabel>
              <NativeSelect
                id="serviceId"
                name="serviceId"
                required
                className="w-full"
                disabled={isPending}
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  setSlotLabel("");
                }}
              >
                <NativeSelectOption value="">Selecione um serviço</NativeSelectOption>
                {services.map((service) => (
                  <NativeSelectOption key={service.id} value={service.id}>
                    {service.name} · {service.duration} min · {priceFormatter.format(service.price)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Data</FieldLabel>
              <Input
                id="date"
                name="date"
                type="date"
                required
                min={minDate}
                disabled={isPending}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSlotLabel("");
                }}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Horários disponíveis</legend>
              <div aria-live="polite" className="flex flex-wrap gap-2">
                {!serviceId || !date ? (
                  <p className="text-muted-foreground text-sm">Selecione um serviço e uma data para ver os horários.</p>
                ) : isFetching ? (
                  Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-9 w-16" />)
                ) : slots.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Sem horários disponíveis para esta data.</p>
                ) : (
                  slots.map((slot, index) => (
                    <label key={slot.startTime} className="cursor-pointer">
                      <input
                        type="radio"
                        name="startTime"
                        value={slot.startTime}
                        required={index === 0}
                        disabled={isPending}
                        className="peer sr-only"
                        onChange={() => setSlotLabel(slot.label)}
                      />
                      <span className="border-border hover:bg-accent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-ring inline-flex h-9 items-center rounded-md border px-3 text-sm peer-focus-visible:ring-2">
                        {slot.label}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <Field>
              <FieldLabel htmlFor="customerName">Seu nome</FieldLabel>
              <Input id="customerName" name="customerName" required minLength={2} maxLength={120} autoComplete="name" disabled={isPending} />
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
              <Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Observações (opcional)</FieldLabel>
              <Textarea id="notes" name="notes" maxLength={2000} disabled={isPending} />
            </Field>
          </FieldGroup>
          {state.message && state.status === "error" ? (
            <Alert variant="destructive" className="mt-5">
              <AlertTitle>Não foi possível agendar</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="public-booking" disabled={isPending || services.length === 0}>
          {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
          {isPending ? "Agendando..." : "Confirmar agendamento"}
        </Button>
      </CardFooter>
    </Card>
  );
}
