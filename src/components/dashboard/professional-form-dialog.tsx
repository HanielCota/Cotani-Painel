"use client";

import { useRef, useState, useTransition } from "react";
import { EditIcon, PlusIcon, UserIcon, XIcon } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useServices } from "@/hooks/use-services";
import { useQueryClient } from "@tanstack/react-query";
import type { ActionResult, ProfessionalListItem } from "@/types";

interface ProfessionalFormDialogProps {
  professional?: ProfessionalListItem;
}

const MAX_IMAGE_SIZE_BYTES = 2_000_000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfessionalFormDialog({ professional }: ProfessionalFormDialogProps) {
  const isEditing = Boolean(professional);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(professional?.imageUrl ?? null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(professional?.serviceIds ?? []);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { data: services, isPending: isServicesPending } = useServices();
  const queryClient = useQueryClient();
  const action = isEditing ? updateProfessionalFromForm : createProfessionalFromForm;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);
    } catch {
      toast.error("Não foi possível carregar a imagem.");
    }
  }

  function handleRemoveImage() {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setPreview(professional?.imageUrl ?? null);
      setSelectedServiceIds(professional?.serviceIds ?? []);
      setResult(null);
    } else {
      formRef.current?.reset();
      setPreview(null);
      setSelectedServiceIds([]);
      setResult(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    formData.set("imageUrl", preview ?? "");
    selectedServiceIds.forEach((serviceId) => formData.append("serviceIds", serviceId));

    startTransition(async () => {
      const nextResult = await action({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
      formRef.current?.reset();
      setPreview(null);
      setSelectedServiceIds([]);
      toast.success(nextResult.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant={isEditing ? "ghost" : "default"} size={isEditing ? "icon" : "sm"} />
        }
      >
        {isEditing ? <EditIcon className="size-4" /> : <><PlusIcon className="size-4" /> Novo profissional</>}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-[600px] overflow-x-hidden overflow-y-auto max-h-[90vh]">
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

            <Field>
              <FieldLabel htmlFor={`professional-photo-${professional?.id ?? "new"}`}>Foto (opcional)</FieldLabel>
              <div className="flex items-center gap-4">
                {preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="" className="size-20 rounded-lg object-cover ring-1 ring-border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="absolute -right-2 -top-2"
                      onClick={handleRemoveImage}
                      disabled={isPending}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <UserIcon className="size-8" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Input
                    id={`professional-photo-${professional?.id ?? "new"}`}
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={isPending}
                    className="w-full sm:w-auto"
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WebP. Máx. 2 MB.</p>
                </div>
              </div>
            </Field>

            <Field>
              <FieldLabel>Serviços atendidos</FieldLabel>
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
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={selected}
                          onChange={() => toggleService(service.id)}
                          disabled={isPending || !service.isActive}
                          className="size-4 accent-primary"
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
            </Field>
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