import { CalendarSyncIcon, CheckIcon, ClockIcon, CreditCardIcon, HistoryIcon, XIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { CancelSubscriptionDialog } from "@/components/dashboard/cancel-subscription-dialog";
import { PaymentHistoryTable } from "@/components/dashboard/payment-history-table";
import { PlanComparisonTable } from "@/components/dashboard/plan-comparison-table";
import { SubscriptionCheckout } from "@/components/dashboard/subscription-checkout";
import { SubscriptionManagement } from "@/components/dashboard/subscription-management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import type { SubscriptionPlan } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import { billingCycleLabel, subscriptionPlanLabel, subscriptionStatusLabel } from "@/lib/display-labels";
import type { PlanFitIssue } from "@/server/services/billing-access";
import type { PaymentHistoryItem } from "@/server/services/payment-history";
import type { getSubscriptionPlanOptions } from "@/server/services/subscription-plan-options";

type SubscriptionPlanOptions = ReturnType<typeof getSubscriptionPlanOptions>;

type CurrentPlanClinic = Pick<
  ClinicModel,
  | "subscriptionStatus"
  | "subscriptionPlan"
  | "subscriptionCycle"
  | "subscriptionExpiresAt"
  | "trialEndsAt"
  | "cancelAtPeriodEnd"
  | "hasPaidOnce"
  | "pendingSubscriptionPlan"
>;

const statusDescription: Record<SubscriptionStatus, string> = {
  TRIALING: "Seu período grátis de 7 dias está ativo. Você pode testar a Cotani sem informar cartão.",
  ACTIVE: "Sua assinatura está em dia. O agendamento público e todas as funções estão liberadas.",
  INACTIVE: "Sua assinatura expirou. Renove agora para reativar o agendamento público e as operações.",
  PAST_DUE: "O pagamento da assinatura está em atraso. Regularize para evitar a suspensão.",
  CANCELED: "A assinatura foi cancelada. Renove para voltar a operar.",
};

function formatShortDate(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function isTrialing(clinic: Pick<ClinicModel, "subscriptionStatus">) {
  return clinic.subscriptionStatus === SubscriptionStatus.TRIALING;
}

// No teste grátis vale o fim do teste; na assinatura paga, a próxima renovação.
function subscriptionRenewalDate(clinic: CurrentPlanClinic) {
  return isTrialing(clinic) ? clinic.trialEndsAt : clinic.subscriptionExpiresAt;
}

export function SubscriptionTabsList() {
  return (
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
  );
}

function StatusSummary({ clinic, active }: { clinic: CurrentPlanClinic; active: boolean }) {
  return (
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
  );
}

function SubscriptionDetailsList({ clinic }: { clinic: CurrentPlanClinic }) {
  const renewalDate = subscriptionRenewalDate(clinic);

  return (
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
        <dt className="text-muted-foreground">{isTrialing(clinic) ? "Teste grátis até" : "Próxima renovação"}</dt>
        <dd className="font-medium">{renewalDate ? formatShortDate(renewalDate) : "-"}</dd>
      </div>
    </dl>
  );
}

function SubscriptionCancellationControls({ clinic, active }: { clinic: CurrentPlanClinic; active: boolean }) {
  if (clinic.cancelAtPeriodEnd) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          Renovação cancelada. O acesso permanece ativo até{" "}
          {clinic.subscriptionExpiresAt ? formatShortDate(clinic.subscriptionExpiresAt) : "o fim do período atual"}.
        </AlertDescription>
      </Alert>
    );
  }

  if (!active) return null;

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <p className="text-sm font-medium text-foreground">Gerenciamento</p>
      <p className="text-sm text-muted-foreground">
        {isTrialing(clinic)
          ? "Você pode encerrar o período grátis a qualquer momento. O acesso será interrompido imediatamente."
          : "Você pode cancelar a renovação a qualquer momento. O acesso permanece até o fim do período pago."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <CancelSubscriptionDialog />
      </div>
    </div>
  );
}

function CurrentStatusCard({ clinic, active }: { clinic: CurrentPlanClinic; active: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="size-5 text-primary" />
          Status atual
        </CardTitle>
        <CardDescription>{statusDescription[clinic.subscriptionStatus]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StatusSummary clinic={clinic} active={active} />

        <SubscriptionDetailsList clinic={clinic} />

        <SubscriptionCancellationControls clinic={clinic} active={active} />
      </CardContent>
    </Card>
  );
}

function PlanComparisonCard({ currentPlan }: { currentPlan: SubscriptionPlan | null }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Comparar planos</CardTitle>
        <CardDescription>O que cada plano inclui. O plano Empresa é contratado com a equipe Cotani.</CardDescription>
      </CardHeader>
      <CardContent>
        <PlanComparisonTable currentPlan={currentPlan} />
      </CardContent>
    </Card>
  );
}

export function CurrentPlanTab({
  clinic,
  active,
  refundEligible,
  issuesByPlan,
}: {
  clinic: CurrentPlanClinic;
  active: boolean;
  refundEligible: boolean;
  issuesByPlan: Partial<Record<SubscriptionPlan, PlanFitIssue[]>>;
}) {
  return (
    <TabsContent value="current" className="mt-6">
      <CurrentStatusCard clinic={clinic} active={active} />
      {active && clinic.hasPaidOnce ? (
        <SubscriptionManagement
          currentPlan={clinic.subscriptionPlan}
          pendingPlan={clinic.pendingSubscriptionPlan}
          cancelAtPeriodEnd={clinic.cancelAtPeriodEnd}
          refundEligible={refundEligible}
          issuesByPlan={issuesByPlan}
        />
      ) : null}
      <PlanComparisonCard currentPlan={clinic.subscriptionPlan} />
    </TabsContent>
  );
}

export function RenewTab({ plans }: { plans: SubscriptionPlanOptions }) {
  return (
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
  );
}

function EmptyPaymentHistory() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background/50 py-10 text-center">
      <HistoryIcon className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Nenhum histórico de pagamento disponível no momento.</p>
      <p className="text-xs text-muted-foreground">
        Os pagamentos realizados aparecerão aqui assim que o gateway confirmar.
      </p>
    </div>
  );
}

export function PaymentHistoryTab({ paymentHistory }: { paymentHistory: PaymentHistoryItem[] }) {
  return (
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
            <EmptyPaymentHistory />
          ) : (
            <PaymentHistoryTable payments={paymentHistory} />
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
