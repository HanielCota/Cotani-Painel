"use client";

import { useActionState } from "react";
import { ExternalLinkIcon, SaveIcon } from "lucide-react";
import Link from "next/link";

import { saveBusinessProfile } from "@/server/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { FileUpload } from "@/components/ui/file-upload";

const initialState: ActionResult = { status: "success", message: "" };
const timeZones = [["America/Sao_Paulo","Brasília (São Paulo)"],["America/Manaus","Manaus"],["America/Cuiaba","Cuiabá"],["America/Rio_Branco","Rio Branco"],["America/Fortaleza","Fortaleza"],["America/Recife","Recife"],["America/Bahia","Salvador"],["America/Belem","Belém"]].map(([value, label]) => ({ value, label }));

interface Props {
  clinic: { name: string; slug: string; timeZone: string; contactEmail: string | null; phone: string | null; address: string | null; publicDescription: string | null; imageUrl: string | null };
}

export function BusinessProfileForm({ clinic }: Props) {
  const [state, action, pending] = useActionState(saveBusinessProfile, initialState);
  useActionFeedback(state);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="business-name">Nome da empresa</Label><Input id="business-name" name="name" defaultValue={clinic.name} minLength={2} maxLength={120} required /></div>
      <div className="space-y-1.5"><Label htmlFor="business-slug">Endereço público</Label><div className="flex items-center rounded-md border bg-background pl-3 text-sm text-muted-foreground"><span>/</span><Input id="business-slug" name="slug" defaultValue={clinic.slug} minLength={2} maxLength={120} required className="border-0 shadow-none" /></div><p className="text-xs text-muted-foreground">Links antigos continuarão funcionando.</p></div>
      <div className="space-y-1.5"><Label htmlFor="business-email">E-mail comercial</Label><Input id="business-email" name="contactEmail" type="email" defaultValue={clinic.contactEmail ?? ""} /></div>
      <div className="space-y-1.5"><Label htmlFor="business-phone">Telefone</Label><Input id="business-phone" name="phone" defaultValue={clinic.phone ?? ""} maxLength={30} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="business-address">Endereço</Label><Input id="business-address" name="address" defaultValue={clinic.address ?? ""} maxLength={300} /></div>
      <div className="space-y-1.5"><Label htmlFor="business-timezone">Fuso horário</Label><Select name="timeZone" defaultValue={clinic.timeZone} items={timeZones}><SelectTrigger id="business-timezone"><SelectValue /></SelectTrigger><SelectContent>{timeZones.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5">
        <Label htmlFor="business-image">Logo ou foto</Label>
        <FileUpload id="business-image" name="image" accept="image/jpeg,image/png,image/webp" title="Escolher imagem" description="JPG, PNG ou WebP · até 2 MB" />
        <input type="hidden" name="currentImageUrl" value={clinic.imageUrl ?? ""} />
        {clinic.imageUrl ? <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><Checkbox name="removeImage" value="on" /> Remover imagem atual</label> : null}
      </div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="business-description">Descrição pública</Label><Textarea id="business-description" name="publicDescription" defaultValue={clinic.publicDescription ?? ""} maxLength={500} rows={4} placeholder="Explique brevemente o que sua empresa oferece." /></div>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" nativeButton={false} variant="outline" className="w-full sm:w-auto" render={<Link href={`/${clinic.slug}`} target="_blank" rel="noreferrer" />}>
          <ExternalLinkIcon />Abrir página pública
        </Button>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto"><SaveIcon />{pending ? "Salvando..." : "Salvar informações"}</Button>
      </div>
    </form>
  );
}
