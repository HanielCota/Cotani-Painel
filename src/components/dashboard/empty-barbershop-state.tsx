"use client";

import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function EmptyBarbershopState() {
  const router = useRouter();

  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma barbearia encontrada</EmptyTitle>
        <EmptyDescription className="max-w-md">
          Selecione uma barbearia no seletor abaixo para acessar o painel. Se ela
          ainda não aparecer, pode ser necessário aguardar a sincronização ou
          solicitar acesso.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            appearance={{ elements: { organizationSwitcherPopoverActions: "hidden" } }}
          />
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCwIcon className="mr-2 size-4" />
            Verificar sincronização
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
