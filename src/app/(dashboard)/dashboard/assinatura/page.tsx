import { CheckIcon, CreditCardIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Assinatura" };

const statusLabel: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelada",
};

const statusDescription: Record<SubscriptionStatus, string> = {
  ACTIVE: "Sua assinatura está em dia. O agendamento público e todas as funções estão liberadas.",
  INACTIVE: "Sua assinatura expirou. Renove agora para reativar o agendamento público e as operações.",
  PAST_DUE: "O pagamento da assinatura está em atraso. Regularize para evitar a suspensão.",
  CANCELED: "A assinatura foi cancelada. Renove para voltar a operar.",
};

const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL?.trim() || null;

export default withTenant(async ({ clinic }) => {
  const active = isSubscriptionActive(clinic);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Assinatura</h1>
        <p className="text-sm text-muted-foreground">Gerencie o plano da {clinic.name}.</p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-5 text-primary" />
            Status atual
          </CardTitle>
          <CardDescription>{statusDescription[clinic.subscriptionStatus]}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-full ${
                active ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"
              }`}
            >
              {active ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}
            </span>
            <div>
              <p className="text-lg font-medium">{statusLabel[clinic.subscriptionStatus]}</p>
              <p className="text-sm text-muted-foreground">
                {active ? "Tudo funcionando normalmente." : "Renovação necessária para continuar."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!active ? (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Renovar assinatura</CardTitle>
            <CardDescription>
              Escolha uma opção abaixo. Assim que o pagamento for confirmado, o painel e o link público são
              reativados automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium">Plano Mensal</p>
                <p className="text-2xl font-semibold">R$ 97,00</p>
                <p className="text-xs text-muted-foreground">Renovação automática todo mês</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium">Plano Anual</p>
                <p className="text-2xl font-semibold">R$ 970,00</p>
                <p className="text-xs text-muted-foreground">2 meses grátis no ano</p>
              </div>
            </div>

            {checkoutUrl ? (
              <Button nativeButton={false} render={<a href={checkoutUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLinkIcon className="mr-2 size-4" />
                Ir para o checkout
              </Button>
            ) : (
              <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                O checkout automático ainda não está configurado. Configure a variável{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_CHECKOUT_URL</code> para ativar o
                botão de redirecionamento.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
});
