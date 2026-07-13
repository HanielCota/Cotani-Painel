"use client";

import { useEffect } from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 p-6">
          <TriangleAlertIcon aria-hidden="true" className="text-destructive" />
          <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">Não foi possível carregar o Cotani neste momento. Tente novamente.</p>
          <Button type="button" onClick={() => unstable_retry()}>
            <RefreshCwIcon data-icon="inline-start" />
            Tentar novamente
          </Button>
        </main>
      </body>
    </html>
  );
}
