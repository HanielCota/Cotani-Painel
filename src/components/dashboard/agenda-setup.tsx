"use client";

import { useActionState } from "react";
import { ContactRoundIcon, TagIcon } from "lucide-react";
import Link from "next/link";

import { createCustomerFromForm } from "@/server/actions/customers";
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
    <Card>
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

function ServiceSetupHint() {
  return (
    <Card>
      <CardHeader>
        <TagIcon />
        <CardTitle>Cadastre um serviço</CardTitle>
        <CardDescription>Defina a duração e o valor para calcular o horário de término.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          O cadastro de serviços agora fica em Configurações. Cadastre pelo menos um serviço para liberar a agenda.
        </p>
      </CardContent>
      <CardFooter>
        <Button nativeButton={false} render={<Link href="/dashboard/configuracoes" />}>
          Abrir configurações
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
      {needsServices ? <ServiceSetupHint /> : null}
    </section>
  );
}
