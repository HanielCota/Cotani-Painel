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

function safeRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState(false);
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

    setPending(false);
    if (result.error) {
      toast.error(result.error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : "Não foi possível concluir o acesso. Tente novamente.");
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      toast.success("Confira seu e-mail para confirmar a conta.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1">
        <button type="button" onClick={() => setMode("sign-in")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "sign-in" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Entrar</button>
        <button type="button" onClick={() => setMode("sign-up")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "sign-up" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Criar conta</button>
      </div>

      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={handleGoogle}>
        Continuar com Google
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou use seu e-mail<span className="h-px flex-1 bg-border" /></div>

      <form action={handleCredentials} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required /></div>
        {mode === "sign-in" ? <Link href="/forgot-password" className="block text-right text-sm text-primary hover:underline">Esqueci minha senha</Link> : <p className="text-xs text-muted-foreground">Use ao menos 8 caracteres. Você receberá a confirmação por e-mail.</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta e testar grátis"}</Button>
      </form>
    </div>
  );
}
