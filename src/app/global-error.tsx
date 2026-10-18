"use client";

import { useEffect } from "react";
import { OctagonXIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
      return;
    }

    console.error("[global-error]", { digest: error.digest });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased">
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 outline-none"
        >
          <div aria-hidden="true" className="public-page-glow absolute inset-x-0 top-0 h-72" />
          <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border/80 bg-card p-8 text-center shadow-card">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <OctagonXIcon aria-hidden="true" className="size-6" />
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Não foi possível carregar o Cotani neste momento. Tente novamente.
              </p>
            </div>
            <Button type="button" onClick={() => unstable_retry()}>
              <RefreshCwIcon data-icon="inline-start" />
              Tentar novamente
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
