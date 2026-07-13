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

export function EmptyClinicState() {
  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Selecione uma clínica</h1>
        <EmptyDescription>
          Crie ou selecione uma organização para configurar o painel desta clínica.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <OrganizationSwitcher hidePersonal />
      </EmptyContent>
    </Empty>
  );
}
