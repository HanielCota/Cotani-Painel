"use client";

import { useState } from "react";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SubscriptionPlan } from "@/generated/prisma/enums";

interface SubscriptionPlanData {
  id: SubscriptionPlan;
  name: string;
  price: number;
  description: string;
}

interface SubscriptionCheckoutProps {
  plans: SubscriptionPlanData[];
}

const priceFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function SubscriptionCheckout({ plans }: SubscriptionCheckoutProps) {
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setPendingPlan(plan);

    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = (await response.json()) as { checkoutUrl?: string; message?: string };

      if (!response.ok) {
        toast.error(data.message ?? "Não foi possível iniciar o checkout.");
        return;
      }

      if (!data.checkoutUrl) {
        toast.error("O checkout não retornou um link de pagamento.");
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch {
      toast.error("Erro de conexão ao iniciar o checkout.");
    } finally {
      setPendingPlan(null);
    }
  }

  const isConfigured = plans.length > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-lg border bg-card p-4">
          <p className="font-medium">{plan.name}</p>
          <p className="text-2xl font-semibold">{priceFormatter.format(plan.price)}</p>
          <p className="text-xs text-muted-foreground">{plan.description}</p>
          <Button
            className="mt-4 w-full"
            disabled={!isConfigured || pendingPlan !== null}
            onClick={() => handleSubscribe(plan.id)}
          >
            {pendingPlan === plan.id ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <ExternalLinkIcon className="mr-2 size-4" />
            )}
            {pendingPlan === plan.id ? "Redirecionando..." : `Assinar ${plan.id === SubscriptionPlan.ANNUAL ? "anual" : "mensal"}`}
          </Button>
        </div>
      ))}

      {!isConfigured ? (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground sm:col-span-2">
          O checkout automático ainda não está configurado. Configure as variáveis{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">MERCADO_PAGO_ACCESS_TOKEN</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">MERCADO_PAGO_MONTHLY_PLAN_ID</code> e{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">MERCADO_PAGO_ANNUAL_PLAN_ID</code> para ativar o
          pagamento.
        </div>
      ) : null}
    </div>
  );
}
