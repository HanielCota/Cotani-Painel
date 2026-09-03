"use client";

import { useActionState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { updateCustomerFromForm } from "@/server/actions/customers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, CustomerListItem } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

interface EditCustomerDialogProps {
  customer: CustomerListItem;
}

export function EditCustomerDialog({ customer }: EditCustomerDialogProps) {
  const [state, formAction, isPending] = useActionState(updateCustomerFromForm, initialState);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["customers"] }).catch(() => {
      toast.error("O cliente foi salvo, mas a lista não pôde ser atualizada.");
    });
  }, [state, queryClient]);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <PencilIcon data-icon="inline-start" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Atualize os dados de contato de {customer.name}.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="customerId" value={customer.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`edit-name-${customer.id}`}>Nome</FieldLabel>
              <Input id={`edit-name-${customer.id}`} name="name" defaultValue={customer.name} required minLength={2} maxLength={120} disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-email-${customer.id}`}>E-mail</FieldLabel>
              <Input id={`edit-email-${customer.id}`} name="email" type="email" defaultValue={customer.email ?? ""} maxLength={254} disabled={isPending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-phone-${customer.id}`}>Telefone</FieldLabel>
              <Input id={`edit-phone-${customer.id}`} name="phone" defaultValue={customer.phone} required minLength={8} maxLength={32} disabled={isPending} />
            </Field>
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-4">
              <AlertTitle>{state.status === "error" ? "Não foi possível atualizar" : "Cliente atualizado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>Fechar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : <PencilIcon data-icon="inline-start" />}
              {isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
