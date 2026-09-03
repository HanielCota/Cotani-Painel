"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PowerIcon, PowerOffIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleServiceActive } from "@/server/actions/services";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult, ServiceListItem } from "@/types";

interface ServiceToggleActiveProps {
  service: ServiceListItem;
}

export function ServiceToggleActive({ service }: ServiceToggleActiveProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const isActive = service.isActive;

  function handleToggle() {
    startTransition(async () => {
      const nextResult = await toggleServiceActive(service.id);

      if (nextResult.status === "success") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["services"] }),
          queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        ]);
        setOpen(false);
        toast.success(nextResult.message);
        return;
      }

      setResult(nextResult);
      toast.error(nextResult.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size="sm" variant={isActive ? "outline" : "secondary"} />}
      >
        {isActive ? <PowerOffIcon data-icon="inline-start" /> : <PowerIcon data-icon="inline-start" />}
        {isActive ? "Desativar" : "Reativar"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isActive ? "Desativar serviço" : "Reativar serviço"}</DialogTitle>
          <DialogDescription>
            {isActive
              ? "Serviços desativados não aparecem no agendamento público, mas mantêm o histórico."
              : "O serviço voltará a aparecer no agendamento público."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Confirma {isActive ? "desativar" : "reativar"} <strong className="font-medium text-foreground">{service.name}</strong>?
        </p>
        {result?.status === "error" && result.message ? (
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancelar</DialogClose>
          <Button type="button" variant={isActive ? "destructive" : "default"} disabled={isPending} onClick={handleToggle}>
            {isPending ? <Spinner data-icon="inline-start" /> : isActive ? <PowerOffIcon data-icon="inline-start" /> : <PowerIcon data-icon="inline-start" />}
            {isPending ? "Processando..." : isActive ? "Desativar" : "Reativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
