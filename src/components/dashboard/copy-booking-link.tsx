"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CopyBookingLinkProps {
  /** URL completa (origin + / + slug), montada no Server Component via headers
   *  — nada de window.location.origin, então não há risco de hydration mismatch. */
  url: string;
}

export function CopyBookingLink({ url }: CopyBookingLinkProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Só limpa o timer no unmount (sem setState no corpo do efeito).
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const input = document.getElementById("booking-link-input") as HTMLInputElement | null;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback sem Clipboard API (contexto não-HTTPS ou permissão negada):
      // seleciona o texto para cópia manual.
      input?.select();
    }

    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        id="booking-link-input"
        readOnly
        value={url}
        aria-label="Link público de agendamento"
        onFocus={(event) => event.target.select()}
        className="font-mono text-sm"
      />
      <Button type="button" variant="outline" onClick={handleCopy} aria-label="Copiar link de agendamento">
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Copiado!" : "Copiar link"}
      </Button>
    </div>
  );
}
