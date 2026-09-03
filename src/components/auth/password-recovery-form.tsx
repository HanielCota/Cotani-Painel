"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AlertCircleIcon, CheckCircle2Icon, MailCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

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

export function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(mode === "request");
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setPending(true);
    setSubmitError(null);
    const supabase = createClient();
    const email = String(formData.get("email") ?? "").trim();
    const error = mode === "request"
      ? (await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` })).error
      : (await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") })).error;
    setPending(false);
    if (error) {
      const message = recoveryErrorMessage(error, mode);
      setSubmitError(message);
      toast.error(message);
      return;
    }
    if (mode === "request") {
      setRequestedEmail(email);
      toast.success("Solicitação enviada. Verifique sua caixa de entrada.");
    }
    else { toast.success("Senha atualizada."); router.push("/dashboard"); router.refresh(); }
  }

  if (mode === "request" && requestedEmail) {
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
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
          <Button type="button" variant="ghost" className="w-full" onClick={() => setRequestedEmail(null)}>Enviar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
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
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Não foi possível atualizar</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending || !ready}>
          {pending ? (mode === "request" ? "Enviando..." : "Atualizando...") : mode === "request" ? "Enviar e-mail de recuperação" : "Atualizar senha"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/sign-in")}>Voltar</Button>
      </form>
    </div>
  );
}
