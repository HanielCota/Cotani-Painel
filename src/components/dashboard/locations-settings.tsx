"use client";

import { useActionState } from "react";
import { Building2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEnterpriseUnit } from "@/server/actions/clinics";

export function LocationsSettings({ enabled, locations }: { enabled: boolean; locations: { id: string; name: string; active: boolean }[] }) {
  const [state, action, pending] = useActionState(createEnterpriseUnit, { status: "success" as const, message: "" });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div><h3 className="font-medium">Unidades vinculadas</h3><p className="text-sm text-muted-foreground">Todas usam a assinatura Empresa da unidade principal.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {locations.map((location) => (
            <div key={location.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Building2Icon className="size-4 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{location.name}</span>
              <span className="text-xs text-muted-foreground">{location.active ? "Ativa" : "Inativa"}</span>
            </div>
          ))}
        </div>
      </div>

      {enabled ? (
        <form action={action} className="max-w-lg space-y-3 rounded-lg border p-4">
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
