"use client";

import { useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, PencilIcon, PlusIcon, TagIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { createServiceFromForm, updateServiceFromForm } from "@/server/actions/services";
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
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, ServiceListItem } from "@/types";

interface ServiceFormDialogProps {
  service?: ServiceListItem;
}

const MAX_FILE_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ServiceFormDialog({ service }: ServiceFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imagePreview, setImagePreview] = useState<string | null>(service?.imageUrl ?? null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const isEditing = Boolean(service);
  const action = isEditing ? updateServiceFromForm : createServiceFromForm;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`A imagem deve ter no máximo ${MAX_FILE_SIZE_MB} MB.`);
      event.target.value = "";
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
      setSelectedFileName(file.name);
    } catch {
      toast.error("Não foi possível ler a imagem.");
      event.target.value = "";
    }
  }

  function handleRemoveImage() {
    setImagePreview(null);
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("imageUrl", imagePreview ?? "");

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
      setImagePreview(null);
      setSelectedFileName(null);
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
            <TagIcon aria-hidden="true" />
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
                placeholder="Ex.: Serviço principal"
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

            <Field>
              <FieldLabel htmlFor={isEditing ? `edit-service-image-${service?.id}` : "service-image"}>Imagem</FieldLabel>
              <div className="flex flex-col gap-3">
                {imagePreview ? (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview do serviço"
                      className="h-32 w-32 rounded-lg object-cover ring-1 ring-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="absolute -top-2 -right-2"
                      onClick={handleRemoveImage}
                      disabled={isPending}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background/60 text-muted-foreground">
                    <ImageIcon className="size-6" />
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
                <Input
                  id={isEditing ? `edit-service-image-${service?.id}` : "service-image"}
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="service-image-help"
                  onChange={handleFileChange}
                  disabled={isPending}
                  className="sr-only"
                />
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                  >
                    <UploadIcon data-icon="inline-start" />
                    {imagePreview ? "Trocar imagem" : "Selecionar imagem"}
                  </Button>
                  <span className="truncate text-sm text-muted-foreground">
                    {selectedFileName ?? (imagePreview ? "Imagem atual" : "Nenhum arquivo selecionado")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground" id="service-image-help">
                  JPG, PNG ou WebP. Máximo {MAX_FILE_SIZE_MB} MB.
                </p>
              </div>
            </Field>
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
              {isPending ? <Spinner data-icon="inline-start" /> : <TagIcon data-icon="inline-start" />}
              {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
