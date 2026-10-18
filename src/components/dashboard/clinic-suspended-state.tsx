import { ShieldAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ClinicSuspendedState({ reason }: { reason?: string | null }) {
  return (
    <Alert variant="destructive" className="max-w-2xl">
      <ShieldAlertIcon />
      <AlertTitle>Negócio temporariamente suspenso</AlertTitle>
      <AlertDescription>
        O acesso operacional foi bloqueado pela administração da Cotani.
        {reason ? ` Motivo: ${reason}` : " Entre em contato com o suporte para mais informações."}
      </AlertDescription>
    </Alert>
  );
}
