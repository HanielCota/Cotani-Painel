import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRoundIcon, LinkIcon, OctagonXIcon, ShieldAlertIcon } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { RecoverySteps } from "@/components/auth/recovery-steps";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutCurrentSession } from "@/server/actions/auth";
import { getRecoveryMfaState } from "@/lib/supabase/recovery-mfa";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type ConfirmRecoveryPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  password: "Use uma senha entre 8 e 256 caracteres.",
  mismatch: "As senhas digitadas não são iguais.",
  weak_password: "Essa senha foi considerada fraca. Escolha uma senha diferente e mais forte.",
  same_password: "A nova senha precisa ser diferente da senha anterior.",
  mfa_unavailable: "Não foi possível confirmar a verificação em duas etapas da sua conta. Tente novamente em instantes.",
  retry: "Não foi possível salvar a senha. Tente novamente.",
};

function Header({ icon: Icon, title, description, tone = "primary" }: { icon: typeof KeyRoundIcon; title: string; description: React.ReactNode; tone?: "primary" | "destructive" }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-3 text-center">
      <span className={tone === "destructive" ? "flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive" : "flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <OctagonXIcon aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function BackToSignIn() {
  return (
    <form action={signOutCurrentSession} className="mt-2">
      <Button type="submit" variant="ghost" className="w-full">Cancelar e voltar ao login</Button>
    </form>
  );
}

function InvalidLinkStep() {
  return (
    <>
      <Header icon={ShieldAlertIcon} tone="destructive" title="Link inválido ou expirado" description="Por segurança, cada link de redefinição funciona uma única vez e por tempo limitado." />
      <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>Solicitar um novo link</Link>
      <BackToSignIn />
    </>
  );
}

// Etapa 1: o token do e-mail só é usado quando a pessoa confirma aqui.
function ConfirmLinkStep({ formError }: { formError: string | null }) {
  return (
    <>
      <Header icon={LinkIcon} title="Redefinir sua senha" description="Confirme que foi você quem pediu a redefinição para continuar." />
      <form action="/auth/callback" method="post" className="space-y-3">
        <input type="hidden" name="intent" value="begin" />
        <FormError message={formError} />
        <Button type="submit" className="w-full">Continuar</Button>
      </form>
      <p className="mt-3 text-center text-xs text-muted-foreground">Não pediu a redefinição? Ignore o e-mail; sua senha atual continua valendo.</p>
      <BackToSignIn />
    </>
  );
}

// Etapa final: link confirmado (e 2FA validado, se a conta tiver).
function NewPasswordStep({ formError, email, includeMfa }: { formError: string | null; email: string | null; includeMfa: boolean }) {
  return (
    <>
      <RecoverySteps current="password" includeMfa={includeMfa} />
      <Header
        icon={KeyRoundIcon}
        title="Crie uma nova senha"
        description={email ? <>Para a conta <strong className="font-medium text-foreground">{email}</strong>.</> : "Escolha uma senha que você não use em outros sites."}
      />
      <form action="/auth/callback" method="post" className="space-y-4">
        <input type="hidden" name="intent" value="password" />
        {email ? <input type="text" name="username" autoComplete="username" defaultValue={email} readOnly hidden /> : null}
        <PasswordField id="password" name="password" label="Nova senha" hint="Mínimo de 8 caracteres." autoComplete="new-password" minLength={8} maxLength={256} required autoFocus />
        <PasswordField id="confirmPassword" name="confirmPassword" label="Confirme a nova senha" autoComplete="new-password" minLength={8} maxLength={256} required />
        <FormError message={formError} />
        <Button type="submit" className="w-full">Salvar nova senha</Button>
        <p className="text-center text-xs text-muted-foreground">Ao salvar, todas as sessões abertas da conta são encerradas e você entra novamente com a nova senha.</p>
      </form>
      <BackToSignIn />
    </>
  );
}

function MfaUnavailableStep({ formError }: { formError: string | null }) {
  return (
    <>
      <Header icon={ShieldAlertIcon} tone="destructive" title="Não foi possível continuar" description="Não conseguimos confirmar a segurança da sua conta agora." />
      <FormError message={formError ?? errorMessages.mfa_unavailable} />
      <Link href="/auth/confirm-recovery" className={buttonVariants({ className: "mt-3 w-full" })}>Tentar novamente</Link>
      <BackToSignIn />
    </>
  );
}

type RecoveryContentProps = {
  error: string | undefined;
  formError: string | null;
  recoverySession: boolean;
  mfa: Awaited<ReturnType<typeof getRecoveryMfaState>> | null;
  email: string | null;
};

function RecoveryContent({ error, formError, recoverySession, mfa, email }: RecoveryContentProps) {
  if (error === "invalid") return <InvalidLinkStep />;
  if (!recoverySession) return <ConfirmLinkStep formError={formError} />;
  if (mfa?.status === "satisfied") return <NewPasswordStep formError={formError} email={email} includeMfa={mfa.enrolled} />;

  return <MfaUnavailableStep formError={formError} />;
}

export default async function ConfirmRecoveryPage({ searchParams }: ConfirmRecoveryPageProps) {
  const params = await searchParams;
  const formError = params.error ? errorMessages[params.error] ?? null : null;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const recoverySession = !claimsError && isRecoverySession(claimsData?.claims);
  const mfa = recoverySession ? await getRecoveryMfaState(supabase) : null;
  if (params.error !== "invalid" && mfa?.status === "required") redirect("/auth/recovery-mfa");
  const email = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none">
      <AuthCard>
        <RecoveryContent error={params.error} formError={formError} recoverySession={recoverySession} mfa={mfa} email={email} />
      </AuthCard>
    </main>
  );
}
