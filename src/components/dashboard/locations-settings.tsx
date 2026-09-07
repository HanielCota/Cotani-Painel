"use client";

import { useActionState } from "react";
import { Building2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createEnterpriseUnit, updateEnterpriseUnit, toggleEnterpriseUnitArchive, copyEnterpriseUnitSetup } from "@/server/actions/clinics";
import { toast } from "sonner";
import { useEffect } from "react";
import type { ActionResult } from "@/types";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";

const initial: ActionResult = { status: "success", message: "" };

function UnitRow({ location }: { location: { id: string; name: string; active: boolean; primary: boolean } }) {
  const [updateState, updateAction, updating] = useActionState(updateEnterpriseUnit, initial);
  const [archiveState, archiveAction, archiving] = useActionState(toggleEnterpriseUnitArchive, initial);
  const [copyState, copyAction, copying] = useActionState(copyEnterpriseUnitSetup, initial);
  useEffect(() => {
    for (const state of [updateState, archiveState, copyState]) {
      if (!state.message) continue;
      if (state.status === "success") toast.success(state.message);
      else toast.error(state.message);
    }
  }, [updateState, archiveState, copyState]);
  return <div className="space-y-4 rounded-xl border border-border/80 bg-background/45 p-4"><div className="flex items-center gap-3"><Building2Icon className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{location.name}{location.primary ? " · Principal" : ""}</span><span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{location.active ? "Ativa" : "Arquivada"}</span></div>{!location.primary ? <><form action={updateAction} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="unitId" value={location.id} /><Input name="name" defaultValue={location.name} aria-label={`Nome de ${location.name}`} /><Button type="submit" size="sm" variant="outline" disabled={updating}>Salvar</Button></form><form action={copyAction} className="flex flex-wrap items-center gap-3 text-xs"><input type="hidden" name="unitId" value={location.id} /><label className="flex cursor-pointer items-center gap-2"><Checkbox name="copyHours" value="on" /> Copiar horários</label><label className="flex cursor-pointer items-center gap-2"><Checkbox name="copyServices" value="on" /> Copiar serviços</label><Button type="submit" size="sm" variant="outline" disabled={copying}>Copiar da principal</Button></form><form action={archiveAction}><input type="hidden" name="unitId" value={location.id} /><Button type="submit" size="sm" variant={location.active ? "destructive" : "outline"} disabled={archiving}>{location.active ? "Arquivar unidade" : "Reativar unidade"}</Button></form></> : null}</div>;
}

export function LocationsSettings({ enabled, locations }: { enabled: boolean; locations: { id: string; name: string; active: boolean; primary: boolean }[] }) {
  const [state, action, pending] = useActionState(createEnterpriseUnit, { status: "success" as const, message: "" });
  const pagination = usePagination(locations);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div><h3 className="font-medium">Unidades vinculadas</h3><p className="text-sm text-muted-foreground">Todas usam a assinatura Empresa da unidade principal.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {pagination.pageItems.map((location) => <UnitRow key={location.id} location={location} />)}
        </div>
        <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={locations.length} onPageChange={pagination.setPage} itemLabelPlural="unidades" />
      </div>

      {enabled ? (
        <form action={action} className="max-w-lg space-y-4 rounded-xl border border-border/80 bg-background/45 p-4">
          <div><h3 className="font-medium">Adicionar unidade</h3><p className="text-sm text-muted-foreground">A nova agenda será criada vazia e você será administrador dela.</p></div>
          {state.message ? <Alert variant={state.status === "error" ? "destructive" : "default"}><AlertDescription>{state.message}</AlertDescription></Alert> : null}
          <div className="space-y-1.5"><Label htmlFor="unit-name">Nome da unidade</Label><Input id="unit-name" name="name" minLength={2} maxLength={120} required /></div>
          <Button type="submit" disabled={pending}>{pending ? "Criando..." : "Criar unidade"}</Button>
        </form>
      ) : (
        <Alert><AlertDescription>O gerenciamento de múltiplas unidades está disponível no plano Empresa.</AlertDescription></Alert>
      )}
    </div>
  );
}
