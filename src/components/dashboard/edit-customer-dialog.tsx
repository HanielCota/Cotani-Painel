"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";

import { deleteCustomer, updateCustomerFromForm } from "@/server/actions/customers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, CustomerListItem } from "@/types";
import { refreshQueries } from "@/lib/refresh-queries";

const initialState: ActionResult = { status: "success", message: "" };

interface EditCustomerDialogProps {
  customer: CustomerListItem;
}

export function EditCustomerDialog({ customer }: EditCustomerDialogProps) {
  const [state, formAction, isPending] = useActionState(updateCustomerFromForm, initialState);
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteCustomer(customer.id);
      toastResult(result);
      setConfirmDelete(false);
      if (result.status === "success") void queryClient.invalidateQueries({ queryKey: ["customers"] });
    });
  }

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
      return;
    }

    void refreshQueries(queryClient, ["customers"], "O cliente foi salvo, mas a lista não pôde ser atualizada.");
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
              <Input
                id={`edit-name-${customer.id}`}
                name="name"
                defaultValue={customer.name}
                required
                minLength={2}
                maxLength={120}
                disabled={isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-return-${customer.id}`}>Próximo retorno</FieldLabel>
              <Input
                id={`edit-return-${customer.id}`}
                name="nextReturnAt"
                type="date"
                defaultValue={customer.nextReturnAt?.slice(0, 10) ?? ""}
                disabled={isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-tags-${customer.id}`}>Etiquetas</FieldLabel>
              <Input
                id={`edit-tags-${customer.id}`}
                name="tags"
                defaultValue={customer.tags.join(", ")}
                placeholder="VIP, indicação, retorno"
                disabled={isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-notes-${customer.id}`}>Observações permanentes</FieldLabel>
              <Textarea
                id={`edit-notes-${customer.id}`}
                name="notes"
                defaultValue={customer.notes ?? ""}
                maxLength={2000}
                disabled={isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-email-${customer.id}`}>E-mail</FieldLabel>
              <Input
                id={`edit-email-${customer.id}`}
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
                maxLength={254}
                disabled={isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`edit-phone-${customer.id}`}>Telefone</FieldLabel>
              <Input
                id={`edit-phone-${customer.id}`}
                name="phone"
                defaultValue={customer.phone}
                required
                minLength={8}
                maxLength={32}
                disabled={isPending}
              />
            </Field>
          </FieldGroup>
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"} className="mt-4">
              <AlertTitle>{state.status === "error" ? "Não foi possível atualizar" : "Cliente atualizado"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {confirmDelete ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Excluir este cliente?</AlertTitle>
              <AlertDescription>
                Esta ação só é permitida quando não existe histórico de atendimentos.
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    Voltar
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}>
                    {deleting ? "Excluindo..." : "Confirmar exclusão"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-5">
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon />
              Excluir
            </Button>
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
