"use client";

import { useState } from "react";
import { CheckIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export interface SubscriptionPlanData {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: readonly string[];
  selfServiceCheckout: boolean;
  configuredCycles: readonly BillingCycle[];
}

interface SubscriptionCheckoutProps {
  plans: SubscriptionPlanData[];
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function SubscriptionCheckout({ plans }: SubscriptionCheckoutProps) {
  const [cycle, setCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setPendingPlan(plan);
    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
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

  return (
    <div className="flex flex-col gap-5">
      <div className="mx-auto flex rounded-full border bg-muted/50 p-1" aria-label="Período de cobrança">
        <Button type="button" size="sm" variant={cycle === BillingCycle.MONTHLY ? "default" : "ghost"} className="rounded-full" onClick={() => setCycle(BillingCycle.MONTHLY)}>
          Mensal
        </Button>
        <Button type="button" size="sm" variant={cycle === BillingCycle.ANNUAL ? "default" : "ghost"} className="rounded-full" onClick={() => setCycle(BillingCycle.ANNUAL)}>
          Anual · economize 20%
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const configured = plan.configuredCycles.includes(cycle);
          const price = cycle === BillingCycle.ANNUAL ? plan.annualPrice : plan.monthlyPrice;
          const isProfessional = plan.id === SubscriptionPlan.PROFESSIONAL;
          return (
            <article key={plan.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-5", isProfessional && "border-primary bg-primary/5 shadow-sm")}>
              {isProfessional ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[11px] font-semibold uppercase text-background">Mais popular</span> : null}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">{priceFormatter.format(price)}</p>
              <p className="text-xs text-muted-foreground">{cycle === BillingCycle.ANNUAL ? "cobrado uma vez por ano" : "por mês"}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /><span>{feature}</span></li>)}
              </ul>
              {plan.selfServiceCheckout ? (
                <Button className="mt-6 w-full" disabled={!configured || pendingPlan !== null} onClick={() => handleSubscribe(plan.id)}>
                  {pendingPlan === plan.id ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <ExternalLinkIcon className="mr-2 size-4" />}
                  {pendingPlan === plan.id ? "Redirecionando..." : configured ? `Assinar ${plan.name}` : "Plano aguardando configuração"}
                </Button>
              ) : (
                <Button nativeButton={false} render={<a href="mailto:contato@cotani.com.br?subject=Plano%20Empresa" />} variant="outline" className="mt-6 w-full">
                  Falar sobre o plano Empresa
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">Novas contas recebem 7 dias grátis para testar a Cotani, sem cartão. Cancele quando quiser.</p>
    </div>
  );
}
