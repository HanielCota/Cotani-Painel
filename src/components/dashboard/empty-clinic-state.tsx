"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClinic } from "@/server/actions/clinics";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMascot,
  EmptyTitle,
} from "@/components/ui/empty";

export function EmptyClinicState() {
  const [state, action, pending] = useActionState(createClinic, { status: "success" as const, message: "" });

  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMascot />
        <EmptyTitle>Cadastre seu negócio</EmptyTitle>
        <EmptyDescription className="max-w-md">
          Configure seu negócio para iniciar os 7 dias grátis e publicar sua agenda online.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-4">
        {state.message ? (
          <Alert variant={state.status === "error" ? "destructive" : "default"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <form action={action} className="w-full space-y-3 text-left">
          <div className="space-y-1.5"><Label htmlFor="clinic-name">Nome do negócio</Label><Input id="clinic-name" name="name" minLength={2} maxLength={120} required placeholder="Ex.: Espaço Central" /></div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Criando..." : "Cadastrar negócio"}</Button>
        </form>
      </EmptyContent>
    </Empty>
  );
}
