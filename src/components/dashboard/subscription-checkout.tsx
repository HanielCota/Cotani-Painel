"use client";

import { useState } from "react";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

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
      <RadioGroup value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)} aria-label="Período de cobrança" className="mx-auto flex-row rounded-full border bg-muted/50 p-1">
        {[{ value: BillingCycle.MONTHLY, label: "Mensal" }, { value: BillingCycle.ANNUAL, label: "Anual · economize 20%" }].map((option) => (
          <label key={option.value} className={cn("flex min-h-8 cursor-pointer items-center rounded-full px-3 text-sm font-medium transition-colors", cycle === option.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <RadioGroupItem value={option.value} className="sr-only" />
            {option.label}
          </label>
        ))}
      </RadioGroup>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const configured = plan.configuredCycles.includes(cycle);
          const price = cycle === BillingCycle.ANNUAL ? plan.annualPrice : plan.monthlyPrice;
          const isProfessional = plan.id === SubscriptionPlan.PROFESSIONAL;
          return (
            <article key={plan.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-5", isProfessional && "border-primary bg-primary/5 shadow-sm")}>
              {isProfessional ? <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase">Mais popular</Badge> : null}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">{formatCurrency(price)}</p>
              <p className="text-xs text-muted-foreground">{cycle === BillingCycle.ANNUAL ? "cobrado uma vez por ano" : "por mês"}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /><span>{feature}</span></li>)}
              </ul>
              {plan.selfServiceCheckout ? (
                <Button className="mt-6 w-full" disabled={!configured || pendingPlan !== null} onClick={() => handleSubscribe(plan.id)}>
                  {pendingPlan === plan.id ? <Spinner data-icon="inline-start" /> : <ExternalLinkIcon data-icon="inline-start" />}
                  {pendingPlan === plan.id ? "Redirecionando..." : configured ? `Assinar ${plan.name}` : "Plano aguardando configuração"}
                </Button>
              ) : (
                <Button type="button" nativeButton={false} render={<a href="mailto:contato@cotani.com.br?subject=Plano%20Empresa" />} variant="outline" className="mt-6 w-full">
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
