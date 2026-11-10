import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import type { TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

export type PasswordRecoveryMode = "request" | "update";

/** Destino de todo link de recuperação: o fluxo protegido (link → 2FA → senha). */
const RECOVERY_REDIRECT_PATH = "/auth/callback?next=/auth/confirm-recovery";

function recoveryErrorMessage(error: { code?: string; message: string }, mode: PasswordRecoveryMode) {
  if (mode === "request") return "Não foi possível enviar o e-mail agora. Tente novamente em instantes.";

  const details = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (details.includes("password should be at least") || details.includes("weak_password")) {
    return "Use uma senha com pelo menos 8 caracteres.";
  }
  if (details.includes("same_password") || details.includes("same password")) {
    return "A nova senha deve ser diferente da senha anterior.";
  }
  if (details.includes("session") || details.includes("jwt") || details.includes("expired")) {
    return "Este link expirou ou já foi utilizado. Peça um novo convite ou link.";
  }
  return "Não foi possível salvar a senha. Tente novamente.";
}

function connectionErrorMessage(mode: PasswordRecoveryMode) {
  if (mode === "request") {
    return "Não foi possível enviar o e-mail agora. Verifique sua conexão e tente novamente.";
  }
  return "Não foi possível salvar a senha. Verifique sua conexão e tente novamente.";
}

function redirectToProtectedRecovery() {
  window.location.replace("/auth/confirm-recovery");
}

function passwordsDoNotMatch(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  return password !== String(formData.get("confirmPassword") ?? password);
}

async function performRecoveryAction(mode: PasswordRecoveryMode, formData: FormData, captchaToken: string | null) {
  const supabase = createClient();
  const email = String(formData.get("email") ?? "").trim();

  if (mode === "request") {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${RECOVERY_REDIRECT_PATH}`,
      ...(captchaToken ? { captchaToken } : {}),
    });
    return { error, email };
  }

  const { error } = await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") });
  return { error, email };
}

/**
 * Acompanha a sessão de quem chegou por convite/checkout. Sessões de
 * recuperação são desviadas para o fluxo protegido. Retorna a limpeza.
 */
function subscribeToInviteSession(onReadyChange: (ready: boolean) => void) {
  const supabase = createClient();
  let active = true;

  async function handleSession(session: Session | null) {
    if (!active) return;
    if (session) {
      const { data } = await supabase.auth.getClaims();
      if (isRecoverySession(data?.claims)) {
        redirectToProtectedRecovery();
        return;
      }
    }
    if (active) onReadyChange(Boolean(session));
  }

  async function loadSession() {
    const { data, error } = await supabase.auth.getSession();
    await handleSession(error ? null : data.session);
  }

  void loadSession();
  const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    if (event === "PASSWORD_RECOVERY") {
      redirectToProtectedRecovery();
      return;
    }
    void handleSession(session);
  });
  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}

function useInviteSessionReady(mode: PasswordRecoveryMode) {
  const [ready, setReady] = useState(mode === "request");

  useEffect(() => {
    if (mode === "request") return;
    return subscribeToInviteSession(setReady);
  }, [mode]);

  return ready;
}

function useRecoverySubmit(
  mode: PasswordRecoveryMode,
  initialError: string | null,
  captchaRef: RefObject<TurnstileWidgetHandle | null>,
) {
  const [pending, setPending] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(initialError);
  const submittingRef = useRef(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    if (mode === "update" && passwordsDoNotMatch(formData)) {
      setSubmitError("As senhas digitadas não são iguais.");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setSubmitError(null);
    let succeeded = false;

    try {
      const { error, email } = await performRecoveryAction(mode, formData, captchaToken);
      if (error) {
        setSubmitError(recoveryErrorMessage(error, mode));
        return;
      }

      succeeded = true;
      if (mode === "request") {
        setRequestedEmail(email);
        return;
      }

      // Primeira senha (convite/checkout): a sessão já é do próprio usuário.
      toast.success("Senha criada. Você já pode usar o painel.");
      window.location.replace("/dashboard");
    } catch {
      setSubmitError(connectionErrorMessage(mode));
    } finally {
      setPending(false);
      if (!succeeded) submittingRef.current = false;
      if (!succeeded && mode === "request") captchaRef.current?.reset();
    }
  }

  function resetRequest() {
    submittingRef.current = false;
    setRequestedEmail(null);
  }

  return { pending, requestedEmail, submitError, captchaToken, setCaptchaToken, submit, resetRequest };
}

async function signOutAndGoToSignIn() {
  try {
    await createClient().auth.signOut({ scope: "local" });
  } finally {
    window.location.replace("/sign-in");
  }
}

export function usePasswordRecovery(
  mode: PasswordRecoveryMode,
  initialError: string | null,
  captchaRef: RefObject<TurnstileWidgetHandle | null>,
) {
  const ready = useInviteSessionReady(mode);
  const recoverySubmit = useRecoverySubmit(mode, initialError, captchaRef);
  const router = useRouter();
  const captchaRequired = mode === "request" && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  function goToSignIn() {
    router.push("/sign-in");
  }

  async function backToSignIn() {
    if (mode === "update") {
      await signOutAndGoToSignIn();
      return;
    }
    goToSignIn();
  }

  return { ...recoverySubmit, ready, captchaRequired, goToSignIn, backToSignIn };
}
