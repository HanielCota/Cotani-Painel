"use client";

import { useRef, type RefObject } from "react";
import { CheckCircle2Icon, KeyRoundIcon, MailCheckIcon, OctagonXIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordField } from "@/components/auth/password-field";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/security/turnstile-widget";
import { usePasswordRecovery, type PasswordRecoveryMode } from "./use-password-recovery";

interface RecoveryEmailSentCardProps {
  email: string;
  onBackToSignIn: () => void;
  onResend: () => void;
}

interface RecoveryFormCardProps {
  isRequest: boolean;
  ready: boolean;
  pending: boolean;
  submitError: string | null;
  submitDisabled: boolean;
  captchaRef: RefObject<TurnstileWidgetHandle | null>;
  onCaptchaTokenChange: (token: string | null) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onBackToSignIn: () => void;
}

function getFormDescription(isRequest: boolean, ready: boolean) {
  if (isRequest) return "Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.";
  if (ready) return "Defina a senha que você usará para entrar no Cotani.";
  return "Validando seu link seguro...";
}

function getSubmitLabel(isRequest: boolean, pending: boolean) {
  if (pending) return isRequest ? "Enviando..." : "Salvando...";
  return isRequest ? "Enviar link de redefinição" : "Salvar senha";
}

function RecoveryEmailSentCard({ email, onBackToSignIn, onResend }: RecoveryEmailSentCardProps) {
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
          Se houver uma conta cadastrada para{" "}
          <strong className="font-medium text-foreground">{email}</strong>, você receberá um link seguro em alguns
          instantes.
        </AlertDescription>
      </Alert>

      <ul className="mb-5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <li>• O link vale por tempo limitado e funciona uma única vez.</li>
        <li>• Abra o link neste mesmo navegador.</li>
        <li>• Não encontrou? Verifique o spam ou aguarde alguns minutos.</li>
      </ul>

      <div className="space-y-2">
        <Button type="button" className="w-full" onClick={onBackToSignIn}>
          Voltar para entrar
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onResend}>
          Enviar novamente
        </Button>
      </div>
    </AuthCard>
  );
}

function RecoveryFormHeader({ isRequest, ready }: { isRequest: boolean; ready: boolean }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <KeyRoundIcon aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">{isRequest ? "Esqueceu sua senha?" : "Crie sua senha"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{getFormDescription(isRequest, ready)}</p>
      </div>
    </div>
  );
}

function EmailField() {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="email">E-mail</Label>
      <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
    </div>
  );
}

function NewPasswordFields({ ready }: { ready: boolean }) {
  return (
    <>
      <PasswordField
        id="password"
        name="password"
        label="Nova senha"
        hint="Mínimo de 8 caracteres."
        autoComplete="new-password"
        minLength={8}
        required
        disabled={!ready}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirme a senha"
        autoComplete="new-password"
        minLength={8}
        required
        disabled={!ready}
      />
    </>
  );
}

function RecoveryErrorAlert({ isRequest, message }: { isRequest: boolean; message: string | null }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" role="alert">
      <OctagonXIcon aria-hidden="true" />
      <AlertTitle>{isRequest ? "Não foi possível continuar" : "Não foi possível salvar"}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function RecoveryFormCard({
  isRequest,
  ready,
  pending,
  submitError,
  submitDisabled,
  captchaRef,
  onCaptchaTokenChange,
  onSubmit,
  onBackToSignIn,
}: RecoveryFormCardProps) {
  return (
    <AuthCard>
      <RecoveryFormHeader isRequest={isRequest} ready={ready} />
      <form action={onSubmit} className="space-y-4">
        {isRequest ? <EmailField /> : <NewPasswordFields ready={ready} />}
        <RecoveryErrorAlert isRequest={isRequest} message={submitError} />
        {isRequest ? (
          <TurnstileWidget ref={captchaRef} action="authentication" onTokenChange={onCaptchaTokenChange} />
        ) : null}
        <Button type="submit" className="w-full" disabled={submitDisabled}>
          {getSubmitLabel(isRequest, pending)}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBackToSignIn}>
          Voltar para entrar
        </Button>
      </form>
    </AuthCard>
  );
}

/**
 * - `request`: pede o e-mail de recuperação.
 * - `update`: define a primeira senha de quem chegou por convite ou checkout.
 *   Sessões de *recuperação* nunca usam esta tela: são desviadas para o fluxo
 *   protegido em `/auth/confirm-recovery`, que exige 2FA quando existir.
 */
export function PasswordRecoveryForm({
  mode,
  initialError = null,
}: {
  mode: PasswordRecoveryMode;
  initialError?: string | null;
}) {
  const captchaRef = useRef<TurnstileWidgetHandle>(null);
  const recovery = usePasswordRecovery(mode, initialError, captchaRef);

  if (mode === "request" && recovery.requestedEmail) {
    return (
      <RecoveryEmailSentCard
        email={recovery.requestedEmail}
        onBackToSignIn={recovery.goToSignIn}
        onResend={recovery.resetRequest}
      />
    );
  }

  const captchaMissing = recovery.captchaRequired && !recovery.captchaToken;

  return (
    <RecoveryFormCard
      isRequest={mode === "request"}
      ready={recovery.ready}
      pending={recovery.pending}
      submitError={recovery.submitError}
      submitDisabled={recovery.pending || !recovery.ready || captchaMissing}
      captchaRef={captchaRef}
      onCaptchaTokenChange={recovery.setCaptchaToken}
      onSubmit={recovery.submit}
      onBackToSignIn={() => void recovery.backToSignIn()}
    />
  );
}
