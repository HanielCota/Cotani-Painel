"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { KeyRoundIcon, LogOutIcon, MailIcon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, createPasswordVerificationClient } from "@/lib/supabase/client";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";

const actionButtonClass = "h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-5";

function validateNewPassword(current: string, next: string, confirmation: string) {
  if (!current) return "Informe sua senha atual.";
  if (next.length < 8) return "Use pelo menos 8 caracteres.";
  if (next !== confirmation) return "A confirmação da nova senha não confere.";
  if (next === current) return "A nova senha deve ser diferente da senha atual.";
  return null;
}

/** Ativação de TOTP (QR + código) e desativação do fator verificado. */
function useTotpFactor() {
  const [verifiedFactorId, setVerifiedFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<{ qr: string; factorId: string } | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setVerifiedFactorId(data?.totp.find((item) => item.status === "verified")?.id ?? "");
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  async function enroll() {
    setPending(true);
    const client = createClient();
    const existing = await client.auth.mfa.listFactors();
    // Remove tentativas anteriores não confirmadas antes de gerar um novo QR.
    for (const factor of existing.data?.totp.filter((item) => item.status !== "verified") ?? []) {
      await client.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Cotani" });
    setPending(false);
    if (error) return void toast.error(error.message);
    setEnrollment({ qr: data.totp.qr_code, factorId: data.id });
  }

  async function verify(code: string) {
    if (!enrollment) return false;
    setPending(true);
    const result = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
    setPending(false);
    if (result.error) {
      toast.error("Código inválido.");
      return false;
    }
    toast.success("Autenticação em dois fatores ativada.");
    setEnrollment(null);
    void refresh();
    return true;
  }

  async function disable() {
    const { error } = await createClient().auth.mfa.unenroll({ factorId: verifiedFactorId });
    if (error) {
      toast.error("Confirme uma sessão com verificação em duas etapas antes de desativar.");
      return false;
    }
    toast.success("Autenticação em dois fatores desativada.");
    setVerifiedFactorId("");
  }

  return { verifiedFactorId, enrollment, pending, enroll, verify, disable };
}

async function signOutOtherSessions() {
  const { error } = await createClient().auth.signOut({ scope: "others" });
  if (error) {
    toast.error("Não foi possível encerrar as outras sessões.");
    return false;
  }
  toast.success("Outras sessões encerradas.");
}

function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileWidgetHandle>(null);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
  const handleCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  async function changePassword() {
    const validationError = validateNewPassword(currentPassword, password, passwordConfirmation);
    setError(validationError);
    if (validationError) return;

    setPending(true);
    const client = createClient();
    const verificationClient = createPasswordVerificationClient();

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user?.email) return setError("Não foi possível confirmar sua identidade.");

      const { error: verificationError } = await verificationClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (verificationError) return setError("A senha atual está incorreta.");

      const { error: updateError } = await client.auth.updateUser({ password, current_password: currentPassword });
      if (updateError) {
        return setError(updateError.code === "weak_password"
          ? "Escolha uma senha mais forte."
          : updateError.code === "same_password"
            ? "A nova senha deve ser diferente da senha atual."
            : "Não foi possível atualizar a senha.");
      }

      toast.success("Senha atualizada com segurança.");
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
    } finally {
      await verificationClient.auth.signOut({ scope: "local" });
      captchaRef.current?.reset();
      setPending(false);
    }
  }

  return (
    <div className="border-t border-border/70 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <KeyRoundIcon className="size-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Alterar senha</p>
          <p className="text-xs text-muted-foreground">Confirme sua senha atual antes de definir uma nova.</p>
        </div>
      </div>
      <form
        className="grid max-w-xl gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void changePassword();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Senha atual</Label>
          <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" aria-invalid={error === "Informe sua senha atual." || error === "A senha atual está incorreta." || undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" aria-describedby="new-password-hint" />
          <p id="new-password-hint" className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input id="confirm-password" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={8} autoComplete="new-password" />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending || (captchaRequired && !captchaToken)} className="w-full">
            {pending ? "Confirmando..." : "Atualizar senha"}
          </Button>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2"><TurnstileWidget ref={captchaRef} action="password-change" onTokenChange={handleCaptchaToken} /></div>
      </form>
      <p className="mt-3 max-w-xl text-xs text-muted-foreground">
        Entrou somente pelo Google e não possui uma senha atual? Use “Recuperar por e-mail” para criar uma senha com confirmação pelo endereço cadastrado.
      </p>
    </div>
  );
}

export function AccountSecuritySettings() {
  const totp = useTotpFactor();
  const [code, setCode] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" nativeButton={false} variant="outline" className={actionButtonClass} render={<Link href="/forgot-password" />}>
          <MailIcon />Recuperar por e-mail
        </Button>
        <ConfirmAction
          trigger={<Button type="button" variant="outline" className={actionButtonClass} />}
          triggerContent={<><LogOutIcon />Encerrar outras sessões</>}
          title="Encerrar outras sessões?"
          description="Todos os outros dispositivos conectados à sua conta precisarão entrar novamente. Esta sessão continua ativa."
          confirmLabel="Encerrar sessões"
          onConfirm={signOutOtherSessions}
        />
        {totp.verifiedFactorId ? (
          <ConfirmAction
            trigger={<Button type="button" variant="outline" className={`${actionButtonClass} text-destructive hover:text-destructive`} />}
            triggerContent={<><ShieldOffIcon />Desativar autenticação em dois fatores</>}
            title="Desativar a verificação em duas etapas?"
            description="Sua conta voltará a ser protegida apenas pela senha. Recomendamos manter a verificação ativa, principalmente para administradores."
            confirmLabel="Desativar"
            onConfirm={totp.disable}
          />
        ) : (
          <Button type="button" variant="outline" className={actionButtonClass} onClick={totp.enroll} disabled={totp.pending}>
            <ShieldCheckIcon />Ativar autenticação em dois fatores
          </Button>
        )}
      </div>

      {totp.enrollment ? (
        <div className="grid gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <Image src={totp.enrollment.qr} alt="QR Code para configurar autenticação em dois fatores" width={176} height={176} unoptimized className="size-40 rounded-lg bg-white p-2" />
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await totp.verify(code)) setCode("");
            }}
          >
            <p className="text-sm leading-5">Leia o QR Code no aplicativo autenticador e informe o código de seis dígitos.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" aria-label="Código de autenticação" />
              <Button type="submit" disabled={totp.pending || code.length !== 6}>Confirmar</Button>
            </div>
          </form>
        </div>
      ) : null}

      <PasswordChangeForm />
    </div>
  );
}
