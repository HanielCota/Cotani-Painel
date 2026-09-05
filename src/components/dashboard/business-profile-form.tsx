"use client";

import { useActionState, useEffect } from "react";
import { SaveIcon } from "lucide-react";
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
      <div className="space-y-1.5"><Label htmlFor="business-timezone">Fuso horário</Label><NativeSelect id="business-timezone" name="timeZone" defaultValue={clinic.timeZone}>{["America/Sao_Paulo","America/Manaus","America/Cuiaba","America/Rio_Branco","America/Fortaleza","America/Recife","America/Bahia","America/Belem"].map((zone) => <NativeSelectOption key={zone} value={zone}>{zone.replace("_", " ")}</NativeSelectOption>)}</NativeSelect></div>
      <div className="space-y-1.5"><Label htmlFor="business-image">Logo ou foto</Label><Input id="business-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" /><input type="hidden" name="currentImageUrl" value={clinic.imageUrl ?? ""} />{clinic.imageUrl ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="removeImage" /> Remover imagem atual</label> : null}</div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="business-description">Descrição pública</Label><Textarea id="business-description" name="publicDescription" defaultValue={clinic.publicDescription ?? ""} maxLength={500} rows={4} placeholder="Explique brevemente o que sua empresa oferece." /></div>
      <div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={pending}><SaveIcon />{pending ? "Salvando..." : "Salvar informações"}</Button></div>
    </form>
  );
}
