"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { Building2Icon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";

export function EmptyBarbershopState() {
  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Selecione uma barbearia</h1>
        <EmptyDescription>
          Selecione a organização da sua barbearia. Se ela não aparecer, o acesso ainda não foi provisionado — verifique o e-mail de convite ou contate o suporte.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {/* Estritamente seleção: criação de organizações não é permitida via UI. */}
        <OrganizationSwitcher hidePersonal appearance={{ elements: { organizationSwitcherPopoverActions: "hidden" } }} />
      </EmptyContent>
    </Empty>
  );
}
