"use client";

import { useEffect } from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
    else console.error("[dashboard-error]", { digest: error.digest });
  }, [error]);

  return (
    <Alert variant="destructive" className="max-w-xl">
      <TriangleAlertIcon />
      <AlertTitle>Não foi possível carregar esta área</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-4">
        <span>Tente novamente. Se o problema persistir, atualize a página ou entre em contato com o suporte.</span>
        <Button type="button" variant="outline" onClick={() => unstable_retry()}>
          <RefreshCwIcon data-icon="inline-start" />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
