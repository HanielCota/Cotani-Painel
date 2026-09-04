import { CreditCardIcon, KeyRoundIcon, PaletteIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountThemeSettings } from "@/components/dashboard/account-theme-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Minha conta" };

const roleLabels = {
  ADMIN: "Administrador",
  RECEPTIONIST: "Recepção",
  PROVIDER: "Profissional",
} as const;

export default withTenant(async ({ membership, role }) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: membership.userId },
    select: { name: true, email: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Minha conta" description="Gerencie sua identidade, segurança e preferências pessoais." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRoundIcon />Dados da conta</CardTitle>
            <CardDescription>Informações usadas para identificar você no painel.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-medium text-muted-foreground">Nome</p><p className="mt-1 font-medium">{user.name}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">E-mail</p><p className="mt-1 break-all font-medium">{user.email ?? "Não informado"}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Perfil de acesso</p><p className="mt-1 font-medium">{roleLabels[role]}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PaletteIcon />Aparência</CardTitle>
            <CardDescription>Escolha como o painel será exibido nesta conta.</CardDescription>
          </CardHeader>
          <CardContent><AccountThemeSettings /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRoundIcon />Segurança</CardTitle>
            <CardDescription>Solicite um link seguro para alterar sua senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} variant="outline" render={<Link href="/forgot-password" />}>Alterar senha</Button>
          </CardContent>
        </Card>

        {role === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCardIcon />Assinatura</CardTitle>
              <CardDescription>Consulte seu plano, vigência e histórico de cobrança.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/assinatura" />}>Ver assinatura</Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
});
