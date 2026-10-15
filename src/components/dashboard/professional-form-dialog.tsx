"use client";

import { useRef } from "react";
import { PencilIcon, PlusIcon, UserIcon } from "lucide-react";

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
import type { ActionResult, ProfessionalListItem, ServiceListItem } from "@/types";
import { useProfessionalForm } from "./use-professional-form";

interface ProfessionalFormDialogProps {
  professional?: ProfessionalListItem;
}

interface ServiceOptionsProps {
  services?: ServiceListItem[];
  isServicesPending: boolean;
  selectedServiceIds: string[];
  isPending: boolean;
  onToggleService: (serviceId: string) => void;
}

interface ServiceOptionProps {
  service: ServiceListItem;
  selected: boolean;
  isPending: boolean;
  onToggle: () => void;
}

interface ProfessionalFieldsProps {
  professional?: ProfessionalListItem;
  open: boolean;
  isPending: boolean;
}

interface ProfessionalDialogFooterProps {
  isEditing: boolean;
  isPending: boolean;
  submitDisabled: boolean;
}

function getSubmitLabel(isPending: boolean, isEditing: boolean) {
  if (isPending) return "Salvando...";
  return isEditing ? "Salvar alterações" : "Cadastrar profissional";
}

function ProfessionalDialogTrigger({ professional }: { professional?: ProfessionalListItem }) {
  const isEditing = Boolean(professional);

  return (
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
      {isEditing ? (
        <PencilIcon aria-hidden="true" className="size-4" />
      ) : (
        <>
          <PlusIcon aria-hidden="true" className="size-4" /> Novo profissional
        </>
      )}
    </DialogTrigger>
  );
}

function ProfessionalDialogHeader({ isEditing }: { isEditing: boolean }) {
  return (
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
  );
}

function ServiceOption({ service, selected, isPending, onToggle }: ServiceOptionProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/50"
      }`}
    >
      <Checkbox
        name="serviceIds"
        value={service.id}
        checked={selected}
        onCheckedChange={onToggle}
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
}

function ServiceOptions({ services, isServicesPending, selectedServiceIds, isPending, onToggleService }: ServiceOptionsProps) {
  if (isServicesPending) return <Spinner />;
  if (!services || services.length === 0) {
    return <p className="text-sm text-muted-foreground">Cadastre serviços antes de vincular profissionais.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {services.map((service) => (
        <ServiceOption
          key={service.id}
          service={service}
          selected={selectedServiceIds.includes(service.id)}
          isPending={isPending}
          onToggle={() => onToggleService(service.id)}
        />
      ))}
    </div>
  );
}

function ProfessionalFields({ professional, open, isPending }: ProfessionalFieldsProps) {
  const idSuffix = professional?.id ?? "new";

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`professional-name-${idSuffix}`}>Nome</FieldLabel>
        <Input
          id={`professional-name-${idSuffix}`}
          name="name"
          defaultValue={professional?.name}
          required
          minLength={2}
          maxLength={120}
          placeholder="Nome do profissional"
          disabled={isPending}
        />
      </Field>

      <ImageUploadField
        key={`${idSuffix}-${open}`}
        id={`professional-photo-${idSuffix}`}
        label="Foto (opcional)"
        initialUrl={professional?.imageUrl}
        alt="Prévia do profissional"
        shape="circle"
        disabled={isPending}
      />
    </>
  );
}

function ProfessionalResultAlert({ result }: { result: ActionResult | null }) {
  if (!result?.message) return null;

  return (
    <Alert variant={result.status === "error" ? "destructive" : "default"} className="mt-4">
      <AlertTitle>{result.status === "error" ? "Não foi possível salvar" : "Profissional salvo"}</AlertTitle>
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

function ProfessionalDialogFooter({ isEditing, isPending, submitDisabled }: ProfessionalDialogFooterProps) {
  return (
    <DialogFooter className="mt-5">
      <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
      <Button type="submit" disabled={submitDisabled}>
        {isPending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        {getSubmitLabel(isPending, isEditing)}
      </Button>
    </DialogFooter>
  );
}

export function ProfessionalFormDialog({ professional }: ProfessionalFormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useProfessionalForm(formRef, professional);
  const submitDisabled = form.isPending || form.selectedServiceIds.length === 0 || form.isServicesPending;

  return (
    <Dialog open={form.open} onOpenChange={form.handleOpenChange}>
      <ProfessionalDialogTrigger professional={professional} />
      <DialogContent className="w-[95vw] sm:max-w-[600px] overflow-x-hidden overflow-y-auto max-h-[90svh]">
        <ProfessionalDialogHeader isEditing={form.isEditing} />

        <form ref={formRef} onSubmit={form.handleSubmit}>
          {form.isEditing && professional ? <input type="hidden" name="professionalId" value={professional.id} /> : null}

          <div className="flex flex-col gap-4">
            <ProfessionalFields professional={professional} open={form.open} isPending={form.isPending} />

            <FieldSet>
              <FieldLegend variant="label">Serviços atendidos</FieldLegend>
              <ServiceOptions
                services={form.services}
                isServicesPending={form.isServicesPending}
                selectedServiceIds={form.selectedServiceIds}
                isPending={form.isPending}
                onToggleService={form.toggleService}
              />
            </FieldSet>
          </div>

          <ProfessionalResultAlert result={form.result} />
          <ProfessionalDialogFooter isEditing={form.isEditing} isPending={form.isPending} submitDisabled={submitDisabled} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
