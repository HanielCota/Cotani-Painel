"use client";

import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2Icon, RefreshCwIcon } from "lucide-react";

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
  errorMessage?: string | null;
}

export function EmptyBarbershopState({ selectedOrgId, errorMessage }: EmptyBarbershopStateProps) {
  const router = useRouter();
  const hasSelectedOrg = Boolean(selectedOrgId);

  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>{hasSelectedOrg ? "Barbearia não sincronizada" : "Nenhuma barbearia encontrada"}</EmptyTitle>
        <EmptyDescription className="max-w-md">
          {hasSelectedOrg
            ? "A organização está selecionada, mas não foi possível sincronizá-la automaticamente. Tente selecionar outra barbearia ou peça suporte."
            : "Selecione uma barbearia no seletor abaixo para acessar o painel."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            appearance={{ elements: { organizationSwitcherPopoverActions: "hidden" } }}
          />

          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCwIcon className="mr-2 size-4" />
            Tentar novamente
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
