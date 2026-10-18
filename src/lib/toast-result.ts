import { toast } from "sonner";

interface ToastableResult {
  status?: string;
  message?: string;
}

/** Mostra o resultado de uma action: "success" como toast de sucesso, o resto como erro. Sem mensagem, não mostra nada. */
export function toastResult(result: ToastableResult | null | undefined) {
  if (!result?.message) return;

  if (result.status === "success") {
    toast.success(result.message);
    return;
  }

  toast.error(result.message);
}
