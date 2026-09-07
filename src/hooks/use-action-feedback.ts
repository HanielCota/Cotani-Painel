"use client"

import { useEffect } from "react"
import { toast } from "sonner"

interface ActionFeedbackState {
  status: "success" | "error"
  message: string
}

export function useActionFeedback(state: ActionFeedbackState) {
  useEffect(() => {
    if (!state.message) return
    if (state.status === "success") toast.success(state.message)
    else toast.error(state.message)
  }, [state])
}
