"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  label: string;
  hint?: string;
}

/** Campo de senha com botão para mostrar/ocultar e dica opcional. */
export function PasswordField({ label, hint, id, className, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input id={inputId} type={visible ? "text" : "password"} aria-describedby={hintId} className={`pr-11 ${className ?? ""}`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOffIcon aria-hidden="true" className="size-4" /> : <EyeIcon aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
