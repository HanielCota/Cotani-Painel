"use client";

import { AlertTriangleIcon, HomeIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-6" />
          </div>
          <CardTitle className="text-xl">Algo deu errado</CardTitle>
          <CardDescription>
            Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === "development" ? (
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
              {error.message}
            </pre>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCwIcon data-icon="inline-start" className="size-4" />
            Tentar novamente
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />} className="w-full sm:w-auto">
            <HomeIcon data-icon="inline-start" className="size-4" />
            Voltar ao início
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
