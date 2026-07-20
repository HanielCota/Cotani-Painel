"use client";

import { useTransition } from "react";
import { PowerIcon, PowerOffIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleProfessionalActive } from "@/server/actions/professionals";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ProfessionalListItem } from "@/types";

interface ProfessionalToggleActiveProps {
  professional: ProfessionalListItem;
}

export function ProfessionalToggleActive({ professional }: ProfessionalToggleActiveProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleProfessionalActive(professional.id);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  }

  return (
    <Button
      type="button"
      variant={professional.isActive ? "outline" : "default"}
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      title={professional.isActive ? "Desativar profissional" : "Reativar profissional"}
    >
      {isPending ? <Spinner className="size-4" /> : professional.isActive ? <PowerOffIcon className="size-4" /> : <PowerIcon className="size-4" />}
    </Button>
  );
}
