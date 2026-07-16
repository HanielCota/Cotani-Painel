"use client";

import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2Icon, MailIcon, RefreshCwIcon } from "lucide-react";

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
        <EmptyTitle>Selecione ou aguarde a sua barbearia</EmptyTitle>
        <EmptyDescription className="max-w-md">
          O acesso ao painel é liberado após a contratação do plano. A barbearia
          é provisionada automaticamente e você recebe um convite por e-mail.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-4">
        <div className="rounded-lg border bg-muted/30 p-4 text-left text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">O que fazer agora:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Se você já contratou: verifique seu e-mail e clique no convite
              para vincular a conta.
            </li>
            <li>
              Se a barbearia aparece no seletor abaixo, selecione-a e aguarde
              alguns segundos para a sincronização.
            </li>
            <li>
              Se ainda não contratou: entre em contato para adquirir um plano.
            </li>
          </ul>
        </div>

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

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MailIcon className="size-3.5" />
          Não encontrou o convite? Verifique a caixa de spam.
        </p>
      </EmptyContent>
    </Empty>
  );
}
