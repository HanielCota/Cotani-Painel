import { CheckIcon, CreditCardIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";

import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
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

export default withTenant(async ({ clinic }) => {
  const active = isSubscriptionActive(clinic);

  const monthlyPlanId = process.env.MERCADO_PAGO_MONTHLY_PLAN_ID?.trim();
  const annualPlanId = process.env.MERCADO_PAGO_ANNUAL_PLAN_ID?.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Assinatura</h1>
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
            <SubscriptionCheckout monthlyPlanId={monthlyPlanId} annualPlanId={annualPlanId} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
});
