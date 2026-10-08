import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type RecoveryStep = "link" | "mfa" | "password";

/**
 * Etapas da recuperação. A etapa de verificação em duas etapas só aparece
 * quando a conta realmente tem 2FA - nunca como "se tiver, informe".
 */
export function RecoverySteps({ current, includeMfa }: { current: RecoveryStep; includeMfa: boolean }) {
  const steps: { id: RecoveryStep; label: string }[] = [
    { id: "link", label: "Confirmar link" },
    ...(includeMfa ? [{ id: "mfa" as const, label: "Verificação" }] : []),
    { id: "password", label: "Nova senha" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Etapas da recuperação de senha">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/15 text-primary ring-2 ring-primary/40",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckIcon aria-hidden="true" className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("truncate text-xs", active ? "font-medium text-foreground" : "text-muted-foreground")}>
              {step.label}
              {done ? <span className="sr-only"> (concluída)</span> : null}
            </span>
            {index < steps.length - 1 ? <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
