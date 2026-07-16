"use client";

import { useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, ScissorsIcon } from "lucide-react";
import { toast } from "sonner";

import { createServiceFromForm, updateServiceFromForm } from "@/server/actions/services";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, ServiceListItem } from "@/types";

interface ServiceFormDialogProps {
  service?: ServiceListItem;
}

export function ServiceFormDialog({ service }: ServiceFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const isEditing = Boolean(service);
  const action = isEditing ? updateServiceFromForm : createServiceFromForm;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const nextResult = await action({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        return;
      }

      setResult(nextResult);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
      formRef.current?.reset();
      toast.success(nextResult.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size={isEditing ? "sm" : "default"} variant={isEditing ? "outline" : "default"} />
        }
      >
        {isEditing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {isEditing ? "Editar" : "Novo serviço"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScissorsIcon aria-hidden="true" />
            {isEditing ? "Editar serviço" : "Novo serviço"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Atualize os dados de ${service?.name}.`
              : "Cadastre um serviço para disponibilizar no agendamento público."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <input type="hidden" name="serviceId" value={service?.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={isEditing ? `edit-service-name-${service?.id}` : "service-name"}>Nome</FieldLabel>
              <Input
                id={isEditing ? `edit-service-name-${service?.id}` : "service-name"}
                name="name"
                placeholder="Ex.: Corte de cabelo"
                defaultValue={service?.name}
                required
                minLength={2}
                maxLength={120}
                disabled={isPending}
              />
            </Field>
            <FieldGroup className="sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={isEditing ? `edit-service-duration-${service?.id}` : "service-duration"}>
                  Duração (minutos)
                </FieldLabel>
                <Input
                  id={isEditing ? `edit-service-duration-${service?.id}` : "service-duration"}
                  name="duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  defaultValue={service?.duration ?? 30}
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={isEditing ? `edit-service-price-${service?.id}` : "service-price"}>
                  Valor (R$)
                </FieldLabel>
                <Input
                  id={isEditing ? `edit-service-price-${service?.id}` : "service-price"}
                  name="price"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={service?.price ?? 0}
                  required
                  disabled={isPending}
                />
              </Field>
            </FieldGroup>
          </FieldGroup>
          {result?.message ? (
            <Alert variant={result.status === "error" ? "destructive" : "default"} className="mt-4">
              <AlertTitle>{result.status === "error" ? "Não foi possível salvar" : "Serviço salvo"}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : <ScissorsIcon data-icon="inline-start" />}
              {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
