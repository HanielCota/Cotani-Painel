import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function UnprovisionedAccountState() {
  return (
    <Empty className="min-h-[60vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Conta não provisionada</EmptyTitle>
        <EmptyDescription className="max-w-md">
          Esta conta não está vinculada a nenhuma barbearia. O acesso ao painel só é liberado após a contratação do
          plano e o convite por e-mail.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex max-w-md flex-col gap-3">
        <Button nativeButton={false} render={<a href="https://cotani-landingpage.vercel.app/checkout?plano=iniciante&ciclo=mensal" target="_blank" rel="noopener noreferrer" />}>
          Contratar plano
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Voltar para o login
        </Button>
      </EmptyContent>
    </Empty>
  );
}
