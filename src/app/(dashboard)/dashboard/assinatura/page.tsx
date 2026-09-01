import { CheckIcon, ClockIcon, CreditCardIcon, HistoryIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Metadata } from "next";

import { CancelSubscriptionDialog } from "@/components/dashboard/cancel-subscription-dialog";
import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
import { PageHeader } from "@/components/dashboard/page-header";
import { SUBSCRIPTION_PLANS, getMercadoPagoPlanEnvKey } from "@/config/subscription-plans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingCycle, SubscriptionStatus } from "@/generated/prisma/enums";
import { billingCycleLabel, paymentStatusLabel, subscriptionPlanLabel } from "@/lib/display-labels";
import { getPaymentHistory } from "@/server/services/payment-history";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Assinatura" };

const statusLabel: Record<SubscriptionStatus, string> = {
  TRIALING: "Período grátis",
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelada",
};

const statusDescription: Record<SubscriptionStatus, string> = {
  TRIALING: "Seu período grátis de 7 dias está ativo. Você pode testar a Cotani sem informar cartão.",
  ACTIVE: "Sua assinatura está em dia. O agendamento público e todas as funções estão liberadas.",
  INACTIVE: "Sua assinatura expirou. Renove agora para reativar o agendamento público e as operações.",
  PAST_DUE: "O pagamento da assinatura está em atraso. Regularize para evitar a suspensão.",
  CANCELED: "A assinatura foi cancelada. Renove para voltar a operar.",
};

function buildPlans() {
  return Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
    ...plan,
    configuredCycles: ([BillingCycle.MONTHLY, BillingCycle.ANNUAL] as const).filter((cycle) =>
      Boolean(process.env[getMercadoPagoPlanEnvKey(plan.id, cycle)]?.trim()),
    ),
  }));
}

const paymentStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  paid: "success",
  approved: "success",
  pending: "secondary",
  refunded: "destructive",
  cancelled: "destructive",
};

export default withTenant(async ({ clinic }) => {
  const active = isSubscriptionActive(clinic);
  const plans = buildPlans();
  const paymentHistory = await getPaymentHistory(clinic);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assinatura" description={`Gerencie o plano da ${clinic.name}.`} />

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

              <dl className="grid gap-3 rounded-xl border bg-background/60 p-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Plano</dt>
                  <dd className="font-medium">{subscriptionPlanLabel(clinic.subscriptionPlan)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cobrança</dt>
                  <dd className="font-medium">{billingCycleLabel(clinic.subscriptionCycle)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {clinic.subscriptionStatus === SubscriptionStatus.TRIALING ? "Teste grátis até" : "Próxima renovação"}
                  </dt>
                  <dd className="font-medium">
                    {(clinic.subscriptionStatus === SubscriptionStatus.TRIALING ? clinic.trialEndsAt : clinic.subscriptionExpiresAt)
                      ? format(clinic.subscriptionStatus === SubscriptionStatus.TRIALING ? clinic.trialEndsAt! : clinic.subscriptionExpiresAt!, "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </dd>
                </div>
              </dl>

              {active && !clinic.cancelAtPeriodEnd ? (
                <div className="flex flex-col gap-2 border-t pt-4">
                  <p className="text-sm font-medium text-foreground">Gerenciamento</p>
                  <p className="text-sm text-muted-foreground">
                    {clinic.subscriptionStatus === SubscriptionStatus.TRIALING
                      ? "Você pode encerrar o período grátis a qualquer momento. O acesso será interrompido imediatamente."
                      : "Você pode cancelar a renovação a qualquer momento. O acesso permanece até o fim do período pago."}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <CancelSubscriptionDialog />
                  </div>
                </div>
              ) : clinic.cancelAtPeriodEnd ? <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Renovação cancelada. O acesso permanece ativo até {clinic.subscriptionExpiresAt ? format(clinic.subscriptionExpiresAt, "dd/MM/yyyy", { locale: ptBR }) : "o fim do período atual"}.</p> : null}
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
              {paymentHistory.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background/50 py-10 text-center">
                  <HistoryIcon className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum histórico de pagamento disponível no momento.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Os pagamentos realizados aparecerão aqui assim que o gateway confirmar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{subscriptionPlanLabel(payment.plan)} · {billingCycleLabel(payment.billingCycle)}</TableCell>
                          <TableCell>
                            <Badge variant={paymentStatusVariant[payment.status] ?? "secondary"}>
                              {paymentStatusLabel(payment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}, ["ADMIN"]);
