import { CreditCardIcon, KeyRoundIcon, PaletteIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountThemeSettings } from "@/components/dashboard/account-theme-settings";
import { AccountProfileSettings } from "@/components/dashboard/account-profile-settings";
import { AccountSecuritySettings } from "@/components/dashboard/account-security-settings";
import { DeleteAccountForm } from "@/components/dashboard/delete-account-form";
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
    select: { name: true, email: true, emailNotifications: true, weeklySummary: true },
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
          <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Perfil de acesso: <strong className="text-foreground">{roleLabels[role]}</strong></p><AccountProfileSettings user={user} /></CardContent>
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
            <CardDescription>Altere sua senha, proteja a conta com 2FA e encerre outras sessões.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4"><Button type="button" nativeButton={false} variant="outline" render={<Link href="/forgot-password" />}>Recuperar senha por e-mail</Button><AccountSecuritySettings /></div>
          </CardContent>
        </Card>

        {role === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCardIcon />Assinatura</CardTitle>
              <CardDescription>Consulte seu plano, vigência e histórico de cobrança.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" nativeButton={false} variant="outline" render={<Link href="/dashboard/assinatura" />}>Ver assinatura</Button>
            </CardContent>
          </Card>
        ) : null}
        <Card className="border-destructive/30"><CardHeader><CardTitle>Excluir conta</CardTitle><CardDescription>Remove seu acesso definitivamente. Os dados das empresas precisam permanecer sob outro administrador.</CardDescription></CardHeader><CardContent><DeleteAccountForm /></CardContent></Card>
      </div>
    </div>
  );
});
