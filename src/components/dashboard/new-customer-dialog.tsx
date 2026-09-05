"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCustomerFromForm } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
export function NewCustomerDialog() {
  const [open, setOpen] = useState(false); const [state, action, pending] = useActionState(createCustomerFromForm, initial); const queryClient = useQueryClient();
  useEffect(() => { if (!state.message) return; if (state.status === "error") toast.error(state.message); else { toast.success(state.message); void queryClient.invalidateQueries({ queryKey: ["customers"] }); queueMicrotask(() => setOpen(false)); } }, [state, queryClient]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button type="button" />}><UserPlusIcon />Novo cliente</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Novo cliente</DialogTitle><DialogDescription>Cadastre os dados e informações de relacionamento.</DialogDescription></DialogHeader><form id="new-customer" action={action}><FieldGroup>
    <Field><FieldLabel htmlFor="new-customer-name">Nome</FieldLabel><Input id="new-customer-name" name="name" minLength={2} maxLength={120} required /></Field>
    <Field><FieldLabel htmlFor="new-customer-phone">Telefone</FieldLabel><Input id="new-customer-phone" name="phone" minLength={8} maxLength={32} required /></Field>
    <Field><FieldLabel htmlFor="new-customer-email">E-mail</FieldLabel><Input id="new-customer-email" name="email" type="email" /></Field>
    <Field><FieldLabel htmlFor="new-customer-return">Próximo retorno</FieldLabel><Input id="new-customer-return" name="nextReturnAt" type="date" /></Field>
    <Field><FieldLabel htmlFor="new-customer-tags">Etiquetas</FieldLabel><Input id="new-customer-tags" name="tags" placeholder="VIP, indicação" /></Field>
    <Field><FieldLabel htmlFor="new-customer-notes">Observações</FieldLabel><Textarea id="new-customer-notes" name="notes" maxLength={2000} /></Field>
  </FieldGroup></form><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="new-customer" disabled={pending}>{pending ? "Salvando..." : "Cadastrar cliente"}</Button></DialogFooter></DialogContent></Dialog>;
}
