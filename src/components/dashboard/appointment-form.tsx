"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createAppointmentFromForm } from "@/server/actions/appointments";
import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
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
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import type { ActionResult, ProfessionalListItem } from "@/types";
import { refreshQueries } from "@/lib/refresh-queries";

const initialState: ActionResult = { status: "success", message: "" };

interface AppointmentFormProps {
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  minStartTime: string;
  timeZone: string;
  className?: string;
  onSuccess?: () => void;
  initialCustomerId?: string;
  /** Horário pré-preenchido (YYYY-MM-DDTHH:mm), ex.: clique num horário vago da agenda. */
  initialStartTime?: string;
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
  const clinicId = useActiveClinicId();
  const [state, formAction, isPending] = useActionState(createAppointmentFromForm, initialState);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const queryClient = useQueryClient();

  const { data: professionals, isFetching: isProfessionalsFetching } = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals"),
  });

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
      return;
    }

    void refreshQueries(queryClient, ["appointments"], "O atendimento foi salvo, mas a lista não pôde ser atualizada.");
    toast.success(state.message);
    onSuccess?.();
  }, [state, queryClient, onSuccess]);

  const availableProfessionals = professionals?.filter(
    (professional) => professional.isActive && professional.serviceIds.includes(serviceId),
  );
  const serviceItems = services.map((service) => ({
    value: service.id,
    label: `${service.name} · ${service.duration} min`,
  }));
  const professionalItems = (availableProfessionals ?? []).map((professional) => ({
    value: professional.id,
    label: professional.name,
  }));

  function handleServiceChange(value: unknown) {
    setServiceId(String(value));
    setProfessionalId("");
  }

  function handleProfessionalChange(value: unknown) {
    setProfessionalId(String(value));
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Adicionar atendimento</CardTitle>
        <CardDescription>Os horários são registrados no horário local do negócio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="create-appointment" action={formAction}>
          <FieldGroup className="md:grid md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
              <CustomerCombobox customers={customers} defaultCustomerId={initialCustomerId} disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="serviceId">Serviço</FieldLabel>
              <Select
                name="serviceId"
                value={serviceId}
                onValueChange={handleServiceChange}
                items={serviceItems}
                disabled={isPending}
                required
              >
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
            <Field>
              <FieldLabel htmlFor="professionalId">Profissional</FieldLabel>
              {isProfessionalsFetching ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  name="professionalId"
                  value={professionalId}
                  onValueChange={handleProfessionalChange}
                  items={professionalItems}
                  disabled={isPending || !serviceId || (availableProfessionals?.length ?? 0) === 0}
                >
                  <SelectTrigger id="professionalId" className="w-full">
                    <SelectValue
                      placeholder={
                        serviceId
                          ? availableProfessionals && availableProfessionals.length > 0
                            ? "Selecione um profissional"
                            : "Nenhum profissional disponível"
                          : "Selecione um serviço primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfessionals?.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
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
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-5">
              <AlertTitle>{state.status === "error" ? "Não foi possível agendar" : "Atendimento criado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="create-appointment" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Spinner data-icon="inline-start" /> : <CalendarPlusIcon data-icon="inline-start" />}
          {isPending ? "Agendando..." : "Agendar atendimento"}
        </Button>
      </CardFooter>
    </Card>
  );
}
