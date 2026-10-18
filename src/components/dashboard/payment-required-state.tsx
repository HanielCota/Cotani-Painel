import { CreditCardIcon } from "lucide-react";

import { SubscriptionOptionsDialog } from "@/components/dashboard/subscription-options-dialog";
import type { SubscriptionPlanData } from "@/components/dashboard/subscription-checkout";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface PaymentRequiredStateProps {
  clinicName?: string;
  plans?: SubscriptionPlanData[];
}

export function PaymentRequiredState({ clinicName, plans }: PaymentRequiredStateProps) {
  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>Assinatura necessária</EmptyTitle>
        <EmptyDescription className="max-w-md">
          {clinicName
            ? `O negócio ${clinicName} ainda não tem um pagamento confirmado. Contrate um plano para liberar o painel.`
            : "Esta conta ainda não tem um pagamento confirmado. Contrate um plano para liberar o painel."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-3">
        {plans ? (
          <SubscriptionOptionsDialog plans={plans} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Peça a um administrador do negócio para contratar ou renovar o plano.
          </p>
        )}
      </EmptyContent>
    </Empty>
  );
}
