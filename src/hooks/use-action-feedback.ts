"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface ActionFeedbackState {
  status: "success" | "error";
  message: string;
}

interface ActionFeedbackOptions {
  /** Executado após o toast de sucesso (ex.: fechar o diálogo). */
  onSuccess?: () => void;
}

export function useActionFeedback(state: ActionFeedbackState, options: ActionFeedbackOptions = {}) {
  const onSuccessRef = useRef(options.onSuccess);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  });

  useEffect(() => {
    if (!state.message) return;
    if (state.status !== "success") {
      toast.error(state.message);
      return;
    }

    toast.success(state.message);
    // Adia para não atualizar estado do pai durante o commit da action.
    const onSuccess = onSuccessRef.current;
    if (onSuccess) queueMicrotask(onSuccess);
  }, [state]);
}
