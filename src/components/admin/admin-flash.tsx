import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AdminFlash({ status, message }: { status?: string; message?: string }) {
  if (!message || !["success", "error"].includes(status ?? "")) return null;
  return (
    <Alert variant={status === "error" ? "destructive" : "default"}>
      <AlertTitle>{status === "error" ? "Não foi possível concluir" : "Operação concluída"}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
