import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailWarningIcon } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutCurrentSession } from "@/server/actions/auth";
import { getRecoveryMfaStatus } from "@/lib/supabase/recovery-mfa";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Confirmar recuperação de senha | Cotani",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type ConfirmRecoveryPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ConfirmRecoveryPage({ searchParams }: ConfirmRecoveryPageProps) {
  const params = await searchParams;
  const invalid = params.error === "invalid";
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const recoverySession = !claimsError && isRecoverySession(claimsData?.claims);
  const status = recoverySession ? await getRecoveryMfaStatus(supabase) : null;
  if (!invalid && status === "required") redirect("/auth/recovery-mfa");
  const errorMessages: Record<string, string> = {
    password: "Use uma senha entre 8 e 256 caracteres.",
    mismatch: "As senhas digitadas não são iguais.",
    weak_password: "Essa senha foi considerada fraca. Escolha uma senha diferente e mais forte.",
    same_password: "A nova senha precisa ser diferente da senha anterior.",
    mfa_unavailable: "Não foi possível confirmar o estado da verificação em duas etapas. Tente novamente.",
    retry: "Não foi possível salvar a senha. Tente novamente nesta página.",
  };
  const formError = params.error ? errorMessages[params.error] ?? null : null;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none">
      <AuthCard>
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MailWarningIcon aria-hidden="true" className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{invalid ? "Link inválido ou expirado" : status === "satisfied" ? "Defina sua nova senha" : "Confirme a redefinição"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invalid
                ? "Solicite um novo e-mail de recuperação para continuar."
                : status === "satisfied"
                  ? "Escolha uma senha com pelo menos 8 caracteres para recuperar o acesso à sua conta."
                  : "Valide o link recebido por e-mail antes de escolher uma nova senha."}
            </p>
          </div>
        </div>

        {invalid ? (
          <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>
            Solicitar novo e-mail
          </Link>
        ) : status === "satisfied" ? (
          <form action="/auth/callback" method="post" className="space-y-3">
            <input type="hidden" name="intent" value="password" />
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={256} required />
            </div>
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
            <Button type="submit" className="w-full">Atualizar senha</Button>
          </form>
        ) : !recoverySession ? (
          <form action="/auth/callback" method="post" className="space-y-3">
            <input type="hidden" name="intent" value="begin" />
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
            <Button type="submit" className="w-full">Continuar para redefinir a senha</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{formError ?? "Não foi possível confirmar sua sessão de recuperação. Atualize a página e tente novamente."}</p>
            <Link href="/auth/confirm-recovery" className={buttonVariants({ className: "w-full" })}>Tentar novamente</Link>
          </div>
        )}
        <form action={signOutCurrentSession} className="mt-3">
          <Button type="submit" variant="ghost" className="w-full">Voltar ao login</Button>
        </form>
      </AuthCard>
    </main>
  );
}
