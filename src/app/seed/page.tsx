"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, Loader2Icon, ScissorsIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface SeedResult {
  message: string;
  clinic: { id: string; name: string; slug: string };
  credentials: { email: string; password: string };
  emailVerified: boolean;
}

export default function SeedPage() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();

    try {
      const response = await fetch("/api/seed-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = (await response.json()) as SeedResult & { message?: string; error?: string; stack?: string };

      if (!response.ok) {
        const detail = data.error ?? data.stack ?? data.message ?? "Erro ao provisionar conta de teste.";
        setError(detail);
        return;
      }

      setResult(data as SeedResult);
    } catch {
      setError("Não foi possível conectar ao servidor. Verifique se o dev server está rodando.");
    } finally {
      setIsPending(false);
    }
  }

  function copyCredentials() {
    if (!result) return;

    void navigator.clipboard.writeText(`E-mail: ${result.credentials.email}\nSenha: ${result.credentials.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-border/80 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScissorsIcon className="size-5" />
          </div>
          <CardTitle className="text-xl">Criar conta de teste</CardTitle>
          <CardDescription>
            Provisione uma barbearia, usuário admin e assinatura ativa para testes locais.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <Alert variant="default" className="border-green-500/20 bg-green-500/5 text-foreground">
              <CheckIcon className="size-4 text-green-500" />
              <AlertTitle>Conta criada</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Barbearia: <strong>{result.clinic.name}</strong></p>
                <p>Slug: <code className="rounded bg-muted px-1 text-xs">{result.clinic.slug}</code></p>
                <div className="rounded border bg-card p-2 text-sm">
                  <p><strong>E-mail:</strong> {result.credentials.email}</p>
                  <p><strong>Senha:</strong> {result.credentials.password}</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyCredentials} className="w-full">
                  {copied ? <CheckIcon className="mr-2 size-4" /> : <CopyIcon className="mr-2 size-4" />}
                  {copied ? "Copiado" : "Copiar credenciais"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue="teste@cotani.com"
                  required
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Nome da barbearia</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  defaultValue="Barbearia Teste"
                  required
                  disabled={isPending}
                />
              </Field>
            </FieldGroup>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
              {isPending ? "Provisionando..." : "Criar conta de teste"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Disponível apenas em desenvolvimento. Em produção esse caminho não existe.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
