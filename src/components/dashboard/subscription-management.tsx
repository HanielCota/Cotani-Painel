"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CreditCardIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import { toastResult } from "@/lib/toast-result";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import {
  cancelScheduledPlanChange,
  reactivateSubscription,
  requestSubscriptionRefund,
  schedulePlanChange,
} from "@/server/actions/subscription";
import type { PlanFitIssue } from "@/server/services/billing-access";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };

function ActionButton({
  action,
  children,
  variant = "outline",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "outline" | "destructive";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          toastResult(result);
          if (result.status === "success") router.refresh();
        })
      }
    >
      {pending ? "Processando..." : children}
    </Button>
  );
}

export function SubscriptionManagement({
  currentPlan,
  pendingPlan,
  cancelAtPeriodEnd,
  issuesByPlan,
  refundEligible,
}: {
  currentPlan: SubscriptionPlan | null;
  pendingPlan: SubscriptionPlan | null;
  cancelAtPeriodEnd: boolean;
  issuesByPlan: Partial<Record<SubscriptionPlan, PlanFitIssue[]>>;
  refundEligible: boolean;
}) {
  const [state, action, pending] = useActionState(schedulePlanChange, initial);
  const router = useRouter();
  useEffect(() => {
    if (!state.message) return;

    toastResult(state);
    if (state.status === "success") router.refresh();
  }, [state, router]);
  const options = [SubscriptionPlan.ESSENTIAL, SubscriptionPlan.PROFESSIONAL].filter((plan) => plan !== currentPlan);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Alterar plano</CardTitle>
          <CardDescription>
            A mudança entra na próxima cobrança. Nada é apagado; downgrades são bloqueados enquanto houver excedentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingPlan ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">
                Troca programada para {pendingPlan === "ESSENTIAL" ? "Essencial" : "Profissional"}.
              </p>
              <ActionButton action={cancelScheduledPlanChange}>
                <RotateCcwIcon />
                Desfazer troca
              </ActionButton>
            </div>
          ) : null}
          {options.map((plan) => {
            const issues = issuesByPlan[plan] ?? [];
            return (
              <div key={plan} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{plan === "ESSENTIAL" ? "Essencial" : "Profissional"}</p>
                    {issues.map((issue) => (
                      <p key={issue.kind} className="text-sm text-warning">
                        {issue.message}
                      </p>
                    ))}
                  </div>
                  {issues.length ? (
                    <Button type="button" nativeButton={false} variant="outline" render={<a href={issues[0].href} />}>
                      <ArrowRightIcon />
                      Resolver excedentes
                    </Button>
                  ) : (
                    <form action={action}>
                      <input type="hidden" name="plan" value={plan} />
                      <Button type="submit" disabled={pending || Boolean(pendingPlan)}>
                        Programar troca
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pagamento e garantia</CardTitle>
          <CardDescription>Dados do cartão permanecem no ambiente seguro do Mercado Pago.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            nativeButton={false}
            variant="outline"
            render={<a href="https://www.mercadopago.com.br/subscriptions" target="_blank" rel="noreferrer" />}
          >
            <CreditCardIcon />
            Gerenciar pagamento
          </Button>
          {cancelAtPeriodEnd ? (
            <ActionButton action={reactivateSubscription}>
              <RotateCcwIcon />
              Reativar renovação
            </ActionButton>
          ) : null}
          {refundEligible ? (
            <ActionButton action={requestSubscriptionRefund} variant="destructive">
              <ShieldCheckIcon />
              Solicitar reembolso de 7 dias
            </ActionButton>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
