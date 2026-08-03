import { CheckIcon, ClockIcon, CreditCardIcon, HistoryIcon, RefreshCwIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";

import { CancelSubscriptionDialog } from "@/components/dashboard/cancel-subscription-dialog";
import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/enums";
import { getPlanConfig } from "@/server/services/mercado-pago";
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

function buildPlans() {
  try {
    const monthly = getPlanConfig(SubscriptionPlan.MONTHLY);
    const annual = getPlanConfig(SubscriptionPlan.ANNUAL);

    return [
      {
        id: monthly.id,
        name: monthly.name,
        price: monthly.price,
        description: "Renovação automática todo mês",
      },
      {
        id: annual.id,
        name: annual.name,
        price: annual.price,
        description: "2 meses grátis no ano",
      },
    ];
  } catch {
    return [];
  }
}

export default withTenant(async ({ clinic }) => {
  const active = isSubscriptionActive(clinic);
  const plans = buildPlans();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          Assinatura
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie o plano da {clinic.name}.</p>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList>
          <TabsTrigger value="current">
            <CreditCardIcon className="mr-2 size-4" />
            Plano atual
          </TabsTrigger>
          <TabsTrigger value="renew">
            <RefreshCwIcon className="mr-2 size-4" />
            Renovar
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="mr-2 size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="size-5 text-primary" />
                Status atual
              </CardTitle>
              <CardDescription>{statusDescription[clinic.subscriptionStatus]}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 items-center justify-center rounded-full ${
                    active ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {active ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}
                </span>
                <div>
                  <p className="text-lg font-medium text-foreground">{statusLabel[clinic.subscriptionStatus]}</p>
                  <p className="text-sm text-muted-foreground">
                    {active ? "Tudo funcionando normalmente." : "Renovação necessária para continuar."}
                  </p>
                </div>
              </div>

              {active ? (
                <div className="flex flex-col gap-2 border-t pt-4">
                  <p className="text-sm font-medium text-foreground">Gerenciamento</p>
                  <p className="text-sm text-muted-foreground">
                    Você pode cancelar sua assinatura a qualquer momento. O acesso permanece até o fim do período
                    pago.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <CancelSubscriptionDialog />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renew" className="mt-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Renovar assinatura</CardTitle>
              <CardDescription>
                Escolha uma opção abaixo. Assim que o pagamento for confirmado, o painel e o link público são
                reativados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SubscriptionCheckout plans={plans} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClockIcon className="size-5 text-primary" />
                Histórico de pagamentos
              </CardTitle>
              <CardDescription>Visualize seus pagamentos anteriores e comprovantes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-center">
                <HistoryIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum histórico de pagamento disponível no momento.
                </p>
                <p className="text-xs text-muted-foreground">
                  {/* TODO: Integrar com backend - PaymentHistory */}
                  Em breve será possível consultar todos os pagamentos realizados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});
