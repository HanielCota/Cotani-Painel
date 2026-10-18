"use client";

import { useRef, useState, useTransition } from "react";
import { PencilIcon, PlusIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createProfessionalFromForm, updateProfessionalFromForm } from "@/server/actions/professionals";
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
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { useServices } from "@/hooks/use-services";
import { useQueryClient } from "@tanstack/react-query";
import type { ActionResult, ProfessionalListItem } from "@/types";

interface ProfessionalFormDialogProps {
  professional?: ProfessionalListItem;
}

export function ProfessionalFormDialog({ professional }: ProfessionalFormDialogProps) {
  const isEditing = Boolean(professional);
  const [open, setOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(professional?.serviceIds ?? []);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { data: services, isPending: isServicesPending } = useServices();
  const queryClient = useQueryClient();
  const action = isEditing ? updateProfessionalFromForm : createProfessionalFromForm;

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setSelectedServiceIds(professional?.serviceIds ?? []);
      setResult(null);
    } else {
      formRef.current?.reset();
      setSelectedServiceIds([]);
      setResult(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    // Checkboxes already contribute their values to FormData. Rebuild this
    // field from state so each selected service is submitted exactly once.
    formData.delete("serviceIds");
    new Set(selectedServiceIds).forEach((serviceId) => formData.append("serviceIds", serviceId));

    startTransition(async () => {
      const nextResult = await action({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["professionals"] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
      ]);
      setOpen(false);
      formRef.current?.reset();
      setSelectedServiceIds([]);
      toast.success(nextResult.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={isEditing ? "ghost" : "default"}
            size={isEditing ? "icon" : "sm"}
            aria-label={isEditing ? `Editar profissional ${professional?.name ?? ""}`.trim() : undefined}
          />
        }
      >
        {isEditing ? <PencilIcon aria-hidden="true" className="size-4" /> : <><PlusIcon aria-hidden="true" className="size-4" /> Novo profissional</>}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-[600px] overflow-x-hidden overflow-y-auto max-h-[90svh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon aria-hidden="true" />
            {isEditing ? "Editar profissional" : "Novo profissional"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados e os serviços atendidos por este profissional."
              : "Cadastre um profissional e defina quais serviços ele atende."}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit}>
          {isEditing && professional ? <input type="hidden" name="professionalId" value={professional.id} /> : null}

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={`professional-name-${professional?.id ?? "new"}`}>Nome</FieldLabel>
              <Input
                id={`professional-name-${professional?.id ?? "new"}`}
                name="name"
                defaultValue={professional?.name}
                required
                minLength={2}
                maxLength={120}
                placeholder="Nome do profissional"
                disabled={isPending}
              />
            </Field>

            <ImageUploadField key={`${professional?.id ?? "new"}-${open}`} id={`professional-photo-${professional?.id ?? "new"}`} label="Foto (opcional)" initialUrl={professional?.imageUrl} alt="Prévia do profissional" shape="circle" disabled={isPending} />

            <FieldSet>
              <FieldLegend variant="label">Serviços atendidos</FieldLegend>
              {isServicesPending ? (
                <Spinner />
              ) : !services || services.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre serviços antes de vincular profissionais.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);

                    return (
                      <label
                        key={service.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          name="serviceIds"
                          value={service.id}
                          checked={selected}
                          onCheckedChange={() => toggleService(service.id)}
                          disabled={isPending || !service.isActive}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className={`text-sm font-medium ${!service.isActive ? "text-muted-foreground line-through" : ""}`}>
                            {service.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{service.duration} min</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </FieldSet>
          </div>

          {result?.message ? (
            <Alert variant={result.status === "error" ? "destructive" : "default"} className="mt-4">
              <AlertTitle>{result.status === "error" ? "Não foi possível salvar" : "Profissional salvo"}</AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending || selectedServiceIds.length === 0 || isServicesPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar profissional"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
