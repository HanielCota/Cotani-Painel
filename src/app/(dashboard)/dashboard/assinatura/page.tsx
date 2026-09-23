import { CalendarSyncIcon, CheckIcon, ClockIcon, CreditCardIcon, HistoryIcon, XIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Metadata } from "next";

import { CancelSubscriptionDialog } from "@/components/dashboard/cancel-subscription-dialog";
import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { billingCycleLabel, subscriptionPlanLabel, subscriptionStatusLabel } from "@/lib/display-labels";
import { getPaymentHistory } from "@/server/services/payment-history";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";
import { getSubscriptionPlanOptions } from "@/server/services/subscription-plan-options";
import { SubscriptionManagement } from "@/components/dashboard/subscription-management";
import { getPlanFitIssues } from "@/server/services/billing-access";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import { PaymentHistoryTable } from "@/components/dashboard/payment-history-table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Assinatura" };

const statusDescription: Record<SubscriptionStatus, string> = {
  TRIALING: "Seu período grátis de 7 dias está ativo. Você pode testar a Cotani sem informar cartão.",
  ACTIVE: "Sua assinatura está em dia. O agendamento público e todas as funções estão liberadas.",
  INACTIVE: "Sua assinatura expirou. Renove agora para reativar o agendamento público e as operações.",
  PAST_DUE: "O pagamento da assinatura está em atraso. Regularize para evitar a suspensão.",
  CANCELED: "A assinatura foi cancelada. Renove para voltar a operar.",
};

export default withTenant(async ({ clinic }) => {
  const active = isSubscriptionActive(clinic);
  const plans = getSubscriptionPlanOptions();
  const paymentHistory = await getPaymentHistory(clinic);
  const [essentialIssues, professionalIssues] = await Promise.all([
    getPlanFitIssues(clinic.billingOwnerId ?? clinic.id, SubscriptionPlan.ESSENTIAL),
    getPlanFitIssues(clinic.billingOwnerId ?? clinic.id, SubscriptionPlan.PROFESSIONAL),
  ]);
  const latestApproved = paymentHistory.find((payment) => payment.status === "approved" && payment.paidAt);
  const refundEligible = Boolean(latestApproved?.paidAt && Date.now() - new Date(latestApproved.paidAt).getTime() <= 7 * 24 * 60 * 60_000);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assinatura" description={`Gerencie o plano da ${clinic.name}.`} />

      <Tabs defaultValue="current" className="w-full">
        <TabsList>
          <TabsTrigger value="current">
            <CreditCardIcon data-icon="inline-start" />
            Plano atual
          </TabsTrigger>
          <TabsTrigger value="renew">
            <CalendarSyncIcon data-icon="inline-start" />
            Renovar
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon data-icon="inline-start" />
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
                  <p className="text-lg font-medium text-foreground">{subscriptionStatusLabel(clinic.subscriptionStatus)}</p>
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
                      : "-"}
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
              ) : clinic.cancelAtPeriodEnd ? <Alert variant="warning"><AlertDescription>Renovação cancelada. O acesso permanece ativo até {clinic.subscriptionExpiresAt ? format(clinic.subscriptionExpiresAt, "dd/MM/yyyy", { locale: ptBR }) : "o fim do período atual"}.</AlertDescription></Alert> : null}
            </CardContent>
          </Card>
          {active && clinic.hasPaidOnce ? <SubscriptionManagement currentPlan={clinic.subscriptionPlan} pendingPlan={clinic.pendingSubscriptionPlan} cancelAtPeriodEnd={clinic.cancelAtPeriodEnd} refundEligible={refundEligible} issuesByPlan={{ ESSENTIAL: essentialIssues, PROFESSIONAL: professionalIssues }} /> : null}
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
                <PaymentHistoryTable payments={paymentHistory} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}, ["ADMIN"]);
