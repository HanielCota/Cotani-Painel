"use client";

import { CalendarPlusIcon } from "lucide-react";

import { CustomerCombobox } from "@/components/dashboard/customer-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionResult, ProfessionalListItem } from "@/types";
import { useAppointmentForm } from "./use-appointment-form";

type AppointmentService = { id: string; name: string; duration: number };

interface AppointmentFormProps {
  customers: Array<{ id: string; name: string }>;
  services: AppointmentService[];
  minStartTime: string;
  timeZone: string;
  className?: string;
  onSuccess?: () => void;
  initialCustomerId?: string;
  /** Horário pré-preenchido (YYYY-MM-DDTHH:mm), ex.: clique num horário vago da agenda. */
  initialStartTime?: string;
}

interface ServiceFieldProps {
  services: AppointmentService[];
  serviceId: string;
  isPending: boolean;
  onServiceChange: (value: unknown) => void;
}

interface ProfessionalFieldProps {
  serviceId: string;
  professionalId: string;
  availableProfessionals?: ProfessionalListItem[];
  isFetching: boolean;
  isPending: boolean;
  onProfessionalChange: (value: unknown) => void;
}

function getProfessionalPlaceholder(serviceId: string, availableCount: number) {
  if (!serviceId) return "Selecione um serviço primeiro";
  return availableCount > 0 ? "Selecione um profissional" : "Nenhum profissional disponível";
}

function ServiceField({ services, serviceId, isPending, onServiceChange }: ServiceFieldProps) {
  const serviceItems = services.map((service) => ({
    value: service.id,
    label: `${service.name} · ${service.duration} min`,
  }));

  return (
    <Field>
      <FieldLabel htmlFor="serviceId">Serviço</FieldLabel>
      <Select name="serviceId" value={serviceId} onValueChange={onServiceChange} items={serviceItems} disabled={isPending} required>
        <SelectTrigger id="serviceId" className="w-full">
          <SelectValue placeholder="Selecione um serviço" />
        </SelectTrigger>
        <SelectContent>
          {services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.name} · {service.duration} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ProfessionalSelect(props: Omit<ProfessionalFieldProps, "isFetching">) {
  const { serviceId, availableProfessionals } = props;
  const availableCount = availableProfessionals?.length ?? 0;
  const professionalItems = (availableProfessionals ?? []).map((professional) => ({
    value: professional.id,
    label: professional.name,
  }));

  return (
    <Select
      name="professionalId"
      value={props.professionalId}
      onValueChange={props.onProfessionalChange}
      items={professionalItems}
      disabled={props.isPending || !serviceId || availableCount === 0}
    >
      <SelectTrigger id="professionalId" className="w-full">
        <SelectValue placeholder={getProfessionalPlaceholder(serviceId, availableCount)} />
      </SelectTrigger>
      <SelectContent>
        {availableProfessionals?.map((professional) => (
          <SelectItem key={professional.id} value={professional.id}>
            {professional.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProfessionalField({ isFetching, ...selectProps }: ProfessionalFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor="professionalId">Profissional</FieldLabel>
      {isFetching ? <Skeleton className="h-9 w-full" /> : <ProfessionalSelect {...selectProps} />}
    </Field>
  );
}

function ScheduleDetailsFields({ minStartTime, initialStartTime, isPending }: { minStartTime: string; initialStartTime?: string; isPending: boolean }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="startTime">Data e horário</FieldLabel>
        <Input
          id="startTime"
          name="startTime"
          type="datetime-local"
          min={minStartTime}
          defaultValue={initialStartTime}
          required
          disabled={isPending}
        />
        <FieldDescription>Escolha um horário futuro.</FieldDescription>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="notes">Observações</FieldLabel>
        <Textarea id="notes" name="notes" placeholder="Opcional" maxLength={2000} disabled={isPending} />
      </Field>
    </>
  );
}

function AppointmentResultAlert({ state }: { state: ActionResult }) {
  if (!state.message) return null;

  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-5">
      <AlertTitle>{state.status === "error" ? "Não foi possível agendar" : "Atendimento criado"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function SubmitAppointmentButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" form="create-appointment" disabled={isPending} className="w-full sm:w-auto">
      {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
      {isPending ? "Agendando..." : "Agendar atendimento"}
    </Button>
  );
}

export function AppointmentForm({
  customers,
  services,
  minStartTime,
  className,
  onSuccess,
  initialCustomerId = "",
  initialStartTime,
}: AppointmentFormProps) {
  const form = useAppointmentForm(onSuccess);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Adicionar atendimento</CardTitle>
        <CardDescription>Os horários são registrados no horário local do negócio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="create-appointment" action={form.formAction}>
          <FieldGroup className="md:grid md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
              <CustomerCombobox customers={customers} defaultCustomerId={initialCustomerId} disabled={form.isPending} />
            </Field>
            <ServiceField services={services} serviceId={form.serviceId} isPending={form.isPending} onServiceChange={form.handleServiceChange} />
            <ProfessionalField
              serviceId={form.serviceId}
              professionalId={form.professionalId}
              availableProfessionals={form.availableProfessionals}
              isFetching={form.isProfessionalsFetching}
              isPending={form.isPending}
              onProfessionalChange={form.handleProfessionalChange}
            />
            <ScheduleDetailsFields minStartTime={minStartTime} initialStartTime={initialStartTime} isPending={form.isPending} />
          </FieldGroup>
          <AppointmentResultAlert state={form.state} />
        </form>
      </CardContent>
      <CardFooter>
        <SubmitAppointmentButton isPending={form.isPending} />
      </CardFooter>
    </Card>
  );
}
