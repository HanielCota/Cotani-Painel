import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
    description: "O agendamento público está desativado. Renove o plano para voltar a operar.",
  },
};

export function SubscriptionBanner({ status }: SubscriptionBannerProps) {
  if (status === SubscriptionStatus.ACTIVE) {
    return null;
  }

  const message = statusMessage[status];

  return (
    <Alert variant="destructive" className="flex flex-col gap-3 border-destructive/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <div>
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.description}</AlertDescription>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        nativeButton={false}
        render={<Link href="/dashboard/assinatura" />}
      >
        Renovar agora
      </Button>
    </Alert>
  );
}
