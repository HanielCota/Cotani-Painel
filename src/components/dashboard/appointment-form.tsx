"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createAppointmentFromForm } from "@/server/actions/appointments";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import type { ActionResult, ProfessionalListItem } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

interface AppointmentFormProps {
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  minStartTime: string;
  timeZone: string;
}

export function AppointmentForm({ customers, services, minStartTime, timeZone }: AppointmentFormProps) {
  const [state, formAction, isPending] = useActionState(createAppointmentFromForm, initialState);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const queryClient = useQueryClient();

  const { data: professionals, isFetching: isProfessionalsFetching } = useQuery({
    queryKey: ["professionals"],
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

    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  }, [state, queryClient]);

  const availableProfessionals = professionals?.filter(
    (professional) => professional.isActive && professional.serviceIds.includes(serviceId),
  );

  function handleServiceChange(value: unknown) {
    setServiceId(String(value));
    setProfessionalId("");
  }

  function handleProfessionalChange(value: unknown) {
    setProfessionalId(String(value));
  }

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Adicionar atendimento</CardTitle>
        <CardDescription>Os horários são registrados no fuso {timeZone}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="create-appointment" action={formAction}>
          <FieldGroup className="md:grid md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="customerId">Cliente</FieldLabel>
              <Select name="customerId" defaultValue="" disabled={isPending} required>
                <SelectTrigger id="customerId" className="w-full">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="serviceId">Serviço</FieldLabel>
              <Select
                name="serviceId"
                value={serviceId}
                onValueChange={handleServiceChange}
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
              <Input id="startTime" name="startTime" type="datetime-local" min={minStartTime} required disabled={isPending} />
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
