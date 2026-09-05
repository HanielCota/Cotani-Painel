"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.85A6 6 0 0 1 6.07 12c0-.64.11-1.27.32-1.85V7.53H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.47l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.35 2.62C7.18 7.78 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

function safeRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback") toast.error("O link de acesso é inválido ou expirou. Solicite um novo e tente novamente.");
  }, [searchParams]);

  async function handleCredentials(formData: FormData) {
    setPending(true);
    const supabase = createClient();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
        });

    if (result.error) {
      setPending(false);
      toast.error(result.error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : "Não foi possível concluir o acesso. Tente novamente.");
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setPending(false);
      toast.success("Confira seu e-mail para confirmar a conta.");
      return;
    }

    if (mode === "sign-in") {
      const factors = await supabase.auth.mfa.listFactors();
      const verified = factors.data?.totp.find((factor) => factor.status === "verified");
      if (verified) { setMfaFactorId(verified.id); setPending(false); return; }
    }

    setPending(false);
    router.push(redirectTo);
    router.refresh();
  }

  async function handleMfa() {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setPending(true); const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode }); setPending(false);
    if (error) { toast.error("Código de autenticação inválido."); return; }
    router.push(redirectTo); router.refresh();
  }

  async function handleGoogle() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    });
    if (error) {
      setPending(false);
      toast.error("Não foi possível iniciar o acesso com Google.");
    }
  }

  return (
    <div className="w-full rounded-2xl border border-border/80 bg-card p-6 shadow-lg">
      <div role="group" aria-label="Tipo de acesso" className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1">
        <button type="button" aria-pressed={mode === "sign-in"} onClick={() => setMode("sign-in")} className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${mode === "sign-in" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Entrar</button>
        <button type="button" aria-pressed={mode === "sign-up"} onClick={() => setMode("sign-up")} className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${mode === "sign-up" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Criar conta</button>
      </div>

      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={handleGoogle}>
        <GoogleIcon />
        Continuar com Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou use seu e-mail<span className="h-px flex-1 bg-border" /></div>

      {mfaFactorId ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Informe o código de 6 dígitos do aplicativo autenticador.</p><Input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de autenticação" /><Button type="button" className="w-full" onClick={handleMfa} disabled={pending || mfaCode.length !== 6}>{pending ? "Verificando..." : "Confirmar código"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => { void createClient().auth.signOut(); setMfaFactorId(null); setMfaCode(""); }}>Voltar</Button></div> : <form action={handleCredentials} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required /></div>
        {mode === "sign-in" ? <Link href="/forgot-password" className="block text-right text-sm text-primary hover:underline">Esqueci minha senha</Link> : <p className="text-center text-xs text-muted-foreground">Use ao menos 8 caracteres. Você receberá a confirmação por e-mail.</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta e testar grátis"}</Button>
      </form>}
    </div>
  );
}
