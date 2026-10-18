"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { CheckCircle2Icon, KeyRoundIcon, MailCheckIcon, OctagonXIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

/** Destino de todo link de recuperação: o fluxo protegido (link → 2FA → senha). */
const RECOVERY_REDIRECT_PATH = "/auth/callback?next=/auth/confirm-recovery";

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
    return "Este link expirou ou já foi utilizado. Peça um novo convite ou link.";
  }
  return "Não foi possível salvar a senha. Tente novamente.";
}

/**
 * - `request`: pede o e-mail de recuperação.
 * - `update`: define a primeira senha de quem chegou por convite ou checkout.
 *   Sessões de *recuperação* nunca usam esta tela: são desviadas para o fluxo
 *   protegido em `/auth/confirm-recovery`, que exige 2FA quando existir.
 */
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

    async function handleSession(session: Session | null) {
      if (!active) return;
      if (session) {
        const { data } = await supabase.auth.getClaims();
        if (isRecoverySession(data?.claims)) {
          window.location.replace("/auth/confirm-recovery");
          return;
        }
      }
      if (active) setReady(Boolean(session));
    }

    void supabase.auth.getSession().then(({ data, error }) => handleSession(error ? null : data.session));
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY") {
        window.location.replace("/auth/confirm-recovery");
        return;
      }
      void handleSession(session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [mode]);

  async function submit(formData: FormData) {
    if (submittingRef.current) return;

    if (mode === "update") {
      const password = String(formData.get("password") ?? "");
      if (password !== String(formData.get("confirmPassword") ?? password)) {
        setSubmitError("As senhas digitadas não são iguais.");
        return;
      }
    }

    submittingRef.current = true;
    setPending(true);
    setSubmitError(null);
    let succeeded = false;

    try {
      const supabase = createClient();
      const email = String(formData.get("email") ?? "").trim();
      const error = mode === "request"
        ? (await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${RECOVERY_REDIRECT_PATH}`, ...(captchaToken ? { captchaToken } : {}) })).error
        : (await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") })).error;

      if (error) {
        setSubmitError(recoveryErrorMessage(error, mode));
        return;
      }

      succeeded = true;
      if (mode === "request") {
        setRequestedEmail(email);
      } else {
        // Primeira senha (convite/checkout): a sessão já é do próprio usuário.
        toast.success("Senha criada. Você já pode usar o painel.");
        window.location.replace("/dashboard");
      }
    } catch {
      setSubmitError(mode === "request"
        ? "Não foi possível enviar o e-mail agora. Verifique sua conexão e tente novamente."
        : "Não foi possível salvar a senha. Verifique sua conexão e tente novamente.");
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

        <ul className="mb-5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>• O link vale por tempo limitado e funciona uma única vez.</li>
          <li>• Abra o link neste mesmo navegador.</li>
          <li>• Não encontrou? Verifique o spam ou aguarde alguns minutos.</li>
        </ul>

        <div className="space-y-2">
          <Button type="button" className="w-full" onClick={() => router.push("/sign-in")}>Voltar para entrar</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={resetRequest}>Enviar novamente</Button>
        </div>
      </AuthCard>
    );
  }

  const isRequest = mode === "request";

  return (
    <AuthCard>
      <div className="mb-5 flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <KeyRoundIcon aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">{isRequest ? "Esqueceu sua senha?" : "Crie sua senha"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRequest
              ? "Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
              : ready ? "Defina a senha que você usará para entrar no Cotani." : "Validando seu link seguro..."}
          </p>
        </div>
      </div>
      <form action={submit} className="space-y-4">
        {isRequest ? (
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
        ) : (
          <>
            <PasswordField id="password" name="password" label="Nova senha" hint="Mínimo de 8 caracteres." autoComplete="new-password" minLength={8} required disabled={!ready} />
            <PasswordField id="confirmPassword" name="confirmPassword" label="Confirme a senha" autoComplete="new-password" minLength={8} required disabled={!ready} />
          </>
        )}
        {submitError ? (
          <Alert variant="destructive" role="alert">
            <OctagonXIcon aria-hidden="true" />
            <AlertTitle>{isRequest ? "Não foi possível continuar" : "Não foi possível salvar"}</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        {isRequest ? <TurnstileWidget ref={captchaRef} action="authentication" onTokenChange={setCaptchaToken} /> : null}
        <Button type="submit" className="w-full" disabled={pending || !ready || (captchaRequired && !captchaToken)}>
          {pending ? (isRequest ? "Enviando..." : "Salvando...") : isRequest ? "Enviar link de redefinição" : "Salvar senha"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void backToSignIn()}>Voltar para entrar</Button>
      </form>
    </AuthCard>
  );
}
