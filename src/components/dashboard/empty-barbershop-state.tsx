"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2Icon, RefreshCwIcon } from "lucide-react";

import { syncActiveClinic } from "@/server/actions/sync-clinic";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface EmptyBarbershopStateProps {
  selectedOrgId?: string | null;
}

export function EmptyBarbershopState({ selectedOrgId }: EmptyBarbershopStateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const hasSelectedOrg = Boolean(selectedOrgId);

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const nextResult = await syncActiveClinic();
      setResult(nextResult);

      if (nextResult.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>{hasSelectedOrg ? "Barbearia não sincronizada" : "Nenhuma barbearia encontrada"}</EmptyTitle>
        <EmptyDescription className="max-w-md">
          {hasSelectedOrg
            ? "A organização está selecionada, mas ainda não foi sincronizada com o banco de dados. Clique em sincronizar abaixo."
            : "Selecione uma barbearia no seletor abaixo para acessar o painel."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-4">
        {result ? (
          <Alert variant={result.status === "error" ? "destructive" : "default"}>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            appearance={{ elements: { organizationSwitcherPopoverActions: "hidden" } }}
          />

          {hasSelectedOrg ? (
            <Button variant="default" size="sm" disabled={isPending} onClick={handleSync}>
              <RefreshCwIcon className="mr-2 size-4" />
              {isPending ? "Sincronizando..." : "Sincronizar barbearia"}
            </Button>
          ) : null}

          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCwIcon className="mr-2 size-4" />
            Verificar sincronização
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
