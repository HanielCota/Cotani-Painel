"use client";

import { CreditCardIcon } from "lucide-react";

import { SubscriptionCheckout, type SubscriptionPlanData } from "@/components/dashboard/subscription-checkout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function SubscriptionOptionsDialog({ plans }: { plans: SubscriptionPlanData[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" size="lg" />}>
        <CreditCardIcon aria-hidden="true" />
        Ver opções de assinatura
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Escolha o plano da sua empresa</DialogTitle>
          <DialogDescription>
            Selecione a forma de cobrança e continue para o ambiente seguro de pagamento.
          </DialogDescription>
        </DialogHeader>
        <SubscriptionCheckout plans={plans} />
      </DialogContent>
    </Dialog>
  );
}
