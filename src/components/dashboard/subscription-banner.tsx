import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubscriptionStatus } from "@/generated/prisma/enums";

interface SubscriptionBannerProps {
  status: SubscriptionStatus;
}

const statusMessage: Record<SubscriptionStatus, { title: string; description: string }> = {
  ACTIVE: { title: "", description: "" },
  INACTIVE: {
    title: "Assinatura inativa",
    description:
      "Você pode visualizar dados, mas não criar agendamentos ou alterar configurações. Renove o plano para reativar.",
  },
  PAST_DUE: {
    title: "Assinatura em atraso",
    description:
      "Regularize o pagamento para evitar a suspensão do agendamento público e das operações de edição.",
  },
  CANCELED: {
    title: "Assinatura cancelada",
    description:
      "O agendamento público está desativado. Entre em contato para reativar a barbearia.",
  },
};

export function SubscriptionBanner({ status }: SubscriptionBannerProps) {
  if (status === SubscriptionStatus.ACTIVE) {
    return null;
  }

  const message = statusMessage[status];

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertTriangleIcon className="size-4" />
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>{message.description}</AlertDescription>
    </Alert>
  );
}
