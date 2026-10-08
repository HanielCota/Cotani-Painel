"use client";

import { PowerIcon, PowerOffIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleProfessionalActive } from "@/server/actions/professionals";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import type { ProfessionalListItem } from "@/types";

interface ProfessionalToggleActiveProps {
  professional: ProfessionalListItem;
}

/** Mesmo padrão de `ServiceToggleActive`: sempre confirma antes de alternar. */
export function ProfessionalToggleActive({ professional }: ProfessionalToggleActiveProps) {
  const isActive = professional.isActive;

  async function handleToggle() {
    const result = await toggleProfessionalActive(professional.id);
    if (result.status === "error") {
      toast.error(result.message);
      return false;
    }
    toast.success(result.message);
  }

  return (
    <ConfirmAction
      trigger={<Button type="button" size="sm" variant={isActive ? "outline" : "secondary"} aria-label={`${isActive ? "Desativar" : "Reativar"} profissional ${professional.name}`} />}
      triggerContent={<>{isActive ? <PowerOffIcon data-icon="inline-start" /> : <PowerIcon data-icon="inline-start" />}{isActive ? "Desativar" : "Reativar"}</>}
      title={isActive ? "Desativar profissional?" : "Reativar profissional?"}
      description={isActive
        ? <><strong className="font-medium text-foreground">{professional.name}</strong> deixará de aparecer no agendamento on-line. O histórico de atendimentos é mantido.</>
        : <><strong className="font-medium text-foreground">{professional.name}</strong> voltará a receber agendamentos on-line.</>}
      confirmLabel={isActive ? "Desativar" : "Reativar"}
      destructive={isActive}
      onConfirm={handleToggle}
    />
  );
}
