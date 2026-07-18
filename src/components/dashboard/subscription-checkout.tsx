"use client";

import { useState } from "react";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import { toast } from "sonner";

interface SubscriptionCheckoutProps {
  monthlyPlanId?: string;
  annualPlanId?: string;
}

export function SubscriptionCheckout({ monthlyPlanId, annualPlanId }: SubscriptionCheckoutProps) {
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

      window.location.href = data.checkoutUrl;
    } catch {
      toast.error("Erro de conexão ao iniciar o checkout.");
    } finally {
      setPendingPlan(null);
    }
  }

  const isConfigured = Boolean(monthlyPlanId) && Boolean(annualPlanId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <p className="font-medium">Plano Mensal</p>
        <p className="text-2xl font-semibold">R$ 97,00</p>
        <p className="text-xs text-muted-foreground">Renovação automática todo mês</p>
        <Button
          className="mt-4 w-full"
          disabled={!isConfigured || pendingPlan !== null}
          onClick={() => handleSubscribe(SubscriptionPlan.MONTHLY)}
        >
          {pendingPlan === SubscriptionPlan.MONTHLY ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <ExternalLinkIcon className="mr-2 size-4" />
          )}
          {pendingPlan === SubscriptionPlan.MONTHLY ? "Redirecionando..." : "Assinar mensal"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="font-medium">Plano Anual</p>
        <p className="text-2xl font-semibold">R$ 970,00</p>
        <p className="text-xs text-muted-foreground">2 meses grátis no ano</p>
        <Button
          className="mt-4 w-full"
          disabled={!isConfigured || pendingPlan !== null}
          onClick={() => handleSubscribe(SubscriptionPlan.ANNUAL)}
        >
          {pendingPlan === SubscriptionPlan.ANNUAL ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <ExternalLinkIcon className="mr-2 size-4" />
          )}
          {pendingPlan === SubscriptionPlan.ANNUAL ? "Redirecionando..." : "Assinar anual"}
        </Button>
      </div>

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
