"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { CheckCircle2Icon, MailCheckIcon, OctagonXIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth/auth-card";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

function recoveryErrorMessage(error: { code?: string; message: string }, mode: "request" | "update") {
  if (mode === "request") return "Não foi possível enviar o e-mail agora. Tente novamente em instantes.";

  const details = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (details.includes("password should be at least") || details.includes("weak_password")) {
    return "Use uma senha com pelo menos 8 caracteres.";
  }
  if (details.includes("same_password") || details.includes("same password")) {
    return "A nova senha deve ser diferente da senha anterior.";
  }
  if (details.includes("session") || details.includes("jwt") || details.includes("expired")) {
    return "Este link expirou ou já foi utilizado. Solicite um novo e-mail de recuperação.";
  }
  return "Não foi possível atualizar a senha. Solicite um novo link e tente novamente.";
}

export function PasswordRecoveryForm({ mode, initialError = null }: { mode: "request" | "update"; initialError?: string | null }) {
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(mode === "request");
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(initialError);
  const submittingRef = useRef(false);
  const captchaRef = useRef<TurnstileWidgetHandle>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequired = mode === "request" && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  const router = useRouter();

  useEffect(() => {
    if (mode === "request") return;
    const supabase = createClient();
    let active = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      setReady(!error && Boolean(data.session));
    }

    void loadSession();
    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (active) setReady(Boolean(session));
      },
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [mode]);

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setSubmitError(null);
    let succeeded = false;

    try {
      const supabase = createClient();
      const email = String(formData.get("email") ?? "").trim();
      const error = mode === "request"
        ? (await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/update-password`, ...(captchaToken ? { captchaToken } : {}) })).error
        : (await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") })).error;

      if (error) {
        const message = recoveryErrorMessage(error, mode);
        setSubmitError(message);
        toast.error(message);
        return;
      }

      succeeded = true;
      if (mode === "request") {
        setRequestedEmail(email);
        toast.success("Solicitação enviada. Verifique sua caixa de entrada.");
      } else {
        toast.success("Senha atualizada.");
        try {
          await supabase.auth.signOut({ scope: "local" });
        } finally {
          window.location.replace("/sign-in?password=updated");
        }
      }
    } catch {
      const message = mode === "request"
        ? "Não foi possível enviar o e-mail agora. Verifique sua conexão e tente novamente."
        : "Não foi possível atualizar a senha. Verifique sua conexão e tente novamente.";
      setSubmitError(message);
      toast.error(message);
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

  async function backToSignIn() {
    if (mode === "update") {
      try {
        await createClient().auth.signOut({ scope: "local" });
      } finally {
        window.location.replace("/sign-in");
      }
      return;
    }
    router.push("/sign-in");
  }

  if (mode === "request" && requestedEmail) {
    return (
      <AuthCard>
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MailCheckIcon aria-hidden="true" className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Verifique seu e-mail</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enviamos as instruções para redefinir sua senha.</p>
          </div>
        </div>

        <Alert role="status" className="mb-4 border-primary/25 bg-primary/5">
          <CheckCircle2Icon aria-hidden="true" className="text-primary" />
          <AlertTitle>Solicitação enviada</AlertTitle>
          <AlertDescription>
            Se houver uma conta cadastrada para <strong className="font-medium text-foreground">{requestedEmail}</strong>, você receberá um link seguro em alguns instantes.
          </AlertDescription>
        </Alert>

        <p className="mb-5 text-center text-xs leading-relaxed text-muted-foreground">
          Não encontrou a mensagem? Verifique a pasta de spam ou aguarde alguns minutos.
        </p>

        <div className="space-y-2">
          <Button type="button" className="w-full" onClick={() => router.push("/sign-in")}>Voltar para entrar</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={resetRequest}>Enviar novamente</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold">{mode === "request" ? "Recuperar senha" : "Definir nova senha"}</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        {mode === "request" ? "Enviaremos um link seguro para seu e-mail." : ready ? "Escolha uma senha com pelo menos 8 caracteres." : "Validando seu link seguro..."}
      </p>
      <form action={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={mode === "request" ? "email" : "password"}>{mode === "request" ? "E-mail" : "Nova senha"}</Label>
          <Input
            id={mode === "request" ? "email" : "password"}
            name={mode === "request" ? "email" : "password"}
            type={mode === "request" ? "email" : "password"}
            autoComplete={mode === "request" ? "email" : "new-password"}
            minLength={mode === "update" ? 8 : undefined}
            required
            disabled={!ready}
          />
        </div>
        {submitError ? (
          <Alert variant="destructive">
            <OctagonXIcon aria-hidden="true" />
            <AlertTitle>Não foi possível atualizar</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        {mode === "request" ? <TurnstileWidget ref={captchaRef} action="authentication" onTokenChange={setCaptchaToken} /> : null}
        <Button type="submit" className="w-full" disabled={pending || !ready || (captchaRequired && !captchaToken)}>
          {pending ? (mode === "request" ? "Enviando..." : "Atualizando...") : mode === "request" ? "Enviar e-mail de recuperação" : "Atualizar senha"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void backToSignIn()}>Voltar</Button>
      </form>
    </AuthCard>
  );
}
