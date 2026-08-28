"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(mode === "request");
  const router = useRouter();

  useEffect(() => {
    if (mode === "request") return;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => setReady(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, [mode]);

  async function submit(formData: FormData) {
    setPending(true);
    const supabase = createClient();
    const error = mode === "request"
      ? (await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? ""), { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` })).error
      : (await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") })).error;
    setPending(false);
    if (error) {
      toast.error("Não foi possível concluir. Revise os dados e tente novamente.");
      return;
    }
    if (mode === "request") toast.success("Se o e-mail estiver cadastrado, enviaremos as instruções.");
    else { toast.success("Senha atualizada."); router.push("/dashboard"); router.refresh(); }
  }

  return <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg"><h1 className="text-xl font-semibold">{mode === "request" ? "Recuperar senha" : "Definir nova senha"}</h1><p className="mb-5 mt-1 text-sm text-muted-foreground">{mode === "request" ? "Enviaremos um link seguro para seu e-mail." : ready ? "Escolha uma senha com pelo menos 8 caracteres." : "Validando seu link seguro..."}</p><form action={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor={mode === "request" ? "email" : "password"}>{mode === "request" ? "E-mail" : "Nova senha"}</Label><Input id={mode === "request" ? "email" : "password"} name={mode === "request" ? "email" : "password"} type={mode === "request" ? "email" : "password"} minLength={mode === "update" ? 8 : undefined} required disabled={!ready} /></div><Button type="submit" className="w-full" disabled={pending || !ready}>{pending ? "Aguarde..." : "Continuar"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/sign-in")}>Voltar</Button></form></div>;
}
