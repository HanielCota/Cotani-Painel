"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markBookingLinkShared } from "@/lib/booking-link-shared";
import { copyText } from "@/lib/clipboard";

interface CopyBookingLinkProps {
  /** URL completa (origin + / + slug), montada no Server Component via headers
   *  - nada de window.location.origin, então não há risco de hydration mismatch. */
  url: string;
}

export function CopyBookingLink({ url }: CopyBookingLinkProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const copiedSuccessfully = await copyText(url);
    if (!copiedSuccessfully) inputRef.current?.select();
    else markBookingLinkShared();

    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        ref={inputRef}
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
