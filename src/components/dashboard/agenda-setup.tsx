"use client";

import { useActionState } from "react";
import { ContactRoundIcon, ScissorsIcon } from "lucide-react";

import { createCustomerFromForm } from "@/server/actions/customers";
import { createServiceFromForm } from "@/server/actions/services";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

function CustomerSetupForm() {
  const [state, formAction, isPending] = useActionState(createCustomerFromForm, initialState);

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader>
        <ContactRoundIcon />
        <CardTitle>Cadastre um cliente</CardTitle>
        <CardDescription>Você precisa de pelo menos um cliente para criar atendimentos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="create-customer" action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-name">Nome</FieldLabel>
              <Input id="customer-name" name="name" autoComplete="name" required disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="customer-phone">Telefone</FieldLabel>
              <Input id="customer-phone" name="phone" autoComplete="tel" inputMode="tel" required disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor="customer-email">E-mail</FieldLabel>
              <Input id="customer-email" name="email" type="email" autoComplete="email" disabled={isPending} />
            </Field>
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-5">
              <AlertTitle>{state.status === "error" ? "Não foi possível cadastrar" : "Cliente cadastrado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="create-customer" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : <ContactRoundIcon data-icon="inline-start" />}
          {isPending ? "Salvando..." : "Adicionar cliente"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ServiceSetupForm() {
  const [state, formAction, isPending] = useActionState(createServiceFromForm, initialState);

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader>
        <ScissorsIcon />
        <CardTitle>Cadastre um serviço</CardTitle>
        <CardDescription>Defina a duração e o valor para calcular o horário de término.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="create-service" action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="service-name">Nome</FieldLabel>
              <Input id="service-name" name="name" placeholder="Ex.: Consulta inicial" required disabled={isPending} />
            </Field>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="service-duration">Duração (minutos)</FieldLabel>
                <Input id="service-duration" name="duration" type="number" min="5" max="480" step="5" defaultValue="30" required disabled={isPending} />
              </Field>
              <Field>
                <FieldLabel htmlFor="service-price">Valor (R$)</FieldLabel>
                <Input id="service-price" name="price" type="number" min="0" step="0.01" defaultValue="0" required disabled={isPending} />
              </Field>
            </FieldGroup>
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-5">
              <AlertTitle>{state.status === "error" ? "Não foi possível cadastrar" : "Serviço cadastrado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="create-service" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : <ScissorsIcon data-icon="inline-start" />}
          {isPending ? "Salvando..." : "Adicionar serviço"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function AgendaSetup({ needsCustomers, needsServices }: { needsCustomers: boolean; needsServices: boolean }) {
  if (!needsCustomers && !needsServices) {
    return null;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Preparar agenda">
      {needsCustomers ? <CustomerSetupForm /> : null}
      {needsServices ? <ServiceSetupForm /> : null}
    </section>
  );
}
