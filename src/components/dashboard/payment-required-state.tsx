import Link from "next/link";
import { CreditCardIcon, MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface PaymentRequiredStateProps {
  barbershopName?: string;
}

export function PaymentRequiredState({ barbershopName }: PaymentRequiredStateProps) {
  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>Assinatura necessária</EmptyTitle>
        <EmptyDescription className="max-w-md">
          {barbershopName
            ? `A barbearia ${barbershopName} ainda não tem um pagamento confirmado. Contrate um plano para liberar o painel.`
            : "Esta conta ainda não tem um pagamento confirmado. Contrate um plano para liberar o painel."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-3">
        <Button
          nativeButton={false}
          render={
            <a
              href="https://wa.me/5511999999999?text=Olá,%20quero%20contratar%20o%20Cotani"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <MessageCircleIcon className="mr-2 size-4" />
          Contratar pelo WhatsApp
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/assinatura" />}>
          Ver opções de assinatura
        </Button>
      </EmptyContent>
    </Empty>
  );
}
