"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, UploadIcon, UserIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface ImageUploadFieldProps {
  id: string;
  label: string;
  initialUrl?: string | null;
  alt: string;
  disabled?: boolean;
  shape?: "square" | "circle";
}

export function ImageUploadField({
  id,
  label,
  initialUrl = null,
  alt,
  disabled = false,
  shape = "square",
}: ImageUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [persistedUrl, setPersistedUrl] = useState(initialUrl ?? "");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const descriptionId = `${id}-description`;

  function releaseObjectUrl() {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  useEffect(() => releaseObjectUrl, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    releaseObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setFileName(file.name);
  }

  function handleRemove() {
    releaseObjectUrl();
    setPreview(null);
    setPersistedUrl("");
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input type="hidden" name="imageUrl" value={persistedUrl} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className={cn("relative flex size-24 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground", shape === "circle" ? "rounded-full" : "rounded-xl")}>
          {preview ? (
            // A prévia pode ser uma URL blob local, que não é aceita pelo next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={alt} className="size-full object-cover" />
          ) : shape === "circle" ? (
            <UserIcon aria-hidden="true" className="size-8" />
          ) : (
            <ImageIcon aria-hidden="true" className="size-7" />
          )}
          {preview ? (
            <Button type="button" size="icon-sm" variant="destructive" className="absolute right-1 top-1" onClick={handleRemove} disabled={disabled} aria-label={`Remover ${label.toLocaleLowerCase("pt-BR")}`}>
              <XIcon aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <input ref={inputRef} id={id} name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={descriptionId} onChange={handleFileChange} disabled={disabled} className="sr-only" />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <UploadIcon data-icon="inline-start" />
            {preview ? "Trocar imagem" : "Selecionar imagem"}
          </Button>
          <p className="max-w-64 truncate text-sm text-muted-foreground">{fileName || (preview ? "Imagem atual" : "Nenhum arquivo selecionado")}</p>
          <FieldDescription id={descriptionId}>JPG, PNG ou WebP. Máximo 2 MB.</FieldDescription>
        </div>
      </div>
    </Field>
  );
}
