"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OctagonXIcon, ShieldCheckIcon } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { RecoverySteps } from "@/components/auth/recovery-steps";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signOutCurrentSession } from "@/server/actions/auth";

interface MfaChallengeFormProps {
  destination: string;
  /** Etapa da recuperação de senha (muda textos e mostra o progresso). */
  recovery?: boolean;
}

export function MfaChallengeForm({ destination, recovery = false }: MfaChallengeFormProps) {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createClient().auth.mfa.listFactors().then(({ data, error: listError }) => {
      const factor = data?.totp.find((item) => item.status === "verified");
      if (listError || !factor) {
        setError("Não foi possível localizar o autenticador desta conta. Atualize a página ou fale com o suporte.");
        return;
      }
      setFactorId(factor.id);
    });
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || code.length !== 6 || pending) return;
    setPending(true);
    setError(null);
    const result = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      setPending(false);
      setCode("");
      setError("Código inválido ou expirado. Confira o aplicativo e digite o código atual.");
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none">
      <AuthCard>
        {recovery ? <RecoverySteps current="mfa" includeMfa /> : null}
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheckIcon aria-hidden="true" className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{recovery ? "Confirme que é você" : "Verificação em duas etapas"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {recovery
                ? "Sua conta usa verificação em duas etapas. Digite o código de 6 dígitos do aplicativo autenticador para criar a nova senha."
                : "Digite o código de 6 dígitos do seu aplicativo autenticador."}
            </p>
          </div>
        </div>

        <form onSubmit={verify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code">Código do autenticador</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="text-center font-mono text-lg tracking-[0.4em]"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "mfa-error" : undefined}
              autoFocus
            />
          </div>
          {error ? (
            <Alert variant="destructive" id="mfa-error" role="alert">
              <OctagonXIcon aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending || !factorId || code.length !== 6}>
            {pending ? "Verificando..." : "Confirmar e continuar"}
          </Button>
        </form>

        {recovery ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Perdeu acesso ao autenticador? Escreva para <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:contato@cotani.com.br">contato@cotani.com.br</a>.
          </p>
        ) : null}

        <form action={signOutCurrentSession} className="mt-2">
          <Button type="submit" variant="ghost" className="w-full">{recovery ? "Cancelar e voltar ao login" : "Sair"}</Button>
        </form>
      </AuthCard>
    </main>
  );
}
