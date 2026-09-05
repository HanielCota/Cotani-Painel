"use client";

import { useActionState, useEffect } from "react";
import { ImageIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { saveBusinessProfile } from "@/server/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

interface Props {
  clinic: { name: string; slug: string; timeZone: string; contactEmail: string | null; phone: string | null; address: string | null; publicDescription: string | null; imageUrl: string | null };
}

export function BusinessProfileForm({ clinic }: Props) {
  const [state, action, pending] = useActionState(saveBusinessProfile, initialState);
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="business-name">Nome da empresa</Label><Input id="business-name" name="name" defaultValue={clinic.name} minLength={2} maxLength={120} required /></div>
      <div className="space-y-1.5"><Label htmlFor="business-slug">Endereço público</Label><div className="flex items-center rounded-md border bg-background pl-3 text-sm text-muted-foreground"><span>/</span><Input id="business-slug" name="slug" defaultValue={clinic.slug} minLength={2} maxLength={120} required className="border-0 shadow-none" /></div><p className="text-xs text-muted-foreground">Links antigos continuarão funcionando.</p></div>
      <div className="space-y-1.5"><Label htmlFor="business-email">E-mail comercial</Label><Input id="business-email" name="contactEmail" type="email" defaultValue={clinic.contactEmail ?? ""} /></div>
      <div className="space-y-1.5"><Label htmlFor="business-phone">Telefone</Label><Input id="business-phone" name="phone" defaultValue={clinic.phone ?? ""} maxLength={30} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="business-address">Endereço</Label><Input id="business-address" name="address" defaultValue={clinic.address ?? ""} maxLength={300} /></div>
      <div className="space-y-1.5"><Label htmlFor="business-timezone">Fuso horário</Label><NativeSelect id="business-timezone" name="timeZone" defaultValue={clinic.timeZone}>{[["America/Sao_Paulo","Brasília (São Paulo)"],["America/Manaus","Manaus"],["America/Cuiaba","Cuiabá"],["America/Rio_Branco","Rio Branco"],["America/Fortaleza","Fortaleza"],["America/Recife","Recife"],["America/Bahia","Salvador"],["America/Belem","Belém"]].map(([zone, label]) => <NativeSelectOption key={zone} value={zone}>{label}</NativeSelectOption>)}</NativeSelect></div>
      <div className="space-y-1.5">
        <Label htmlFor="business-image">Logo ou foto</Label>
        <label htmlFor="business-image" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background/55 px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <ImageIcon className="size-5 shrink-0 text-primary" />
          <span><strong className="font-medium text-foreground">Escolher imagem</strong><span className="mt-0.5 block text-xs text-muted-foreground">JPG, PNG ou WebP · até 2 MB</span></span>
          <input id="business-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
        </label>
        <input type="hidden" name="currentImageUrl" value={clinic.imageUrl ?? ""} />
        {clinic.imageUrl ? <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="removeImage" className="size-4 accent-primary" /> Remover imagem atual</label> : null}
      </div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="business-description">Descrição pública</Label><Textarea id="business-description" name="publicDescription" defaultValue={clinic.publicDescription ?? ""} maxLength={500} rows={4} placeholder="Explique brevemente o que sua empresa oferece." /></div>
      <div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={pending}><SaveIcon />{pending ? "Salvando..." : "Salvar informações"}</Button></div>
    </form>
  );
}
