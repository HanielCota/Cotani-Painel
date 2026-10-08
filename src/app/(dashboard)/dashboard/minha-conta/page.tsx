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
import { clinicRoleLabel } from "@/lib/display-labels";

export const metadata: Metadata = { title: "Minha conta" };

export default withTenant(async ({ membership, role }) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: membership.userId },
    select: { name: true, email: true, emailNotifications: true, weeklySummary: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Minha conta" description="Gerencie sua identidade, segurança e preferências pessoais." />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle><UserRoundIcon className="text-primary" />Dados da conta</CardTitle>
              <CardDescription>Informações usadas para identificar você no painel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">Perfil de acesso: <strong className="text-foreground">{clinicRoleLabel(role)}</strong></p>
              <AccountProfileSettings user={user} />
            </CardContent>
          </Card>

          <Card id="seguranca" className="scroll-mt-24">
            <CardHeader>
              <CardTitle><KeyRoundIcon className="text-primary" />Segurança</CardTitle>
              <CardDescription>Altere sua senha, proteja a conta com 2FA e encerre outras sessões.</CardDescription>
            </CardHeader>
            <CardContent><AccountSecuritySettings /></CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle><PaletteIcon className="text-primary" />Aparência</CardTitle>
              <CardDescription>Modo claro/escuro, tema de fundo e cor de destaque. Vale para este navegador.</CardDescription>
            </CardHeader>
            <CardContent><AccountThemeSettings /></CardContent>
          </Card>

          {role === "ADMIN" ? (
            <Card>
              <CardHeader>
                <CardTitle><CreditCardIcon className="text-primary" />Assinatura</CardTitle>
                <CardDescription>Consulte seu plano, vigência e histórico de cobrança.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" nativeButton={false} variant="outline" render={<Link href="/dashboard/assinatura" />}>Ver assinatura</Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="border-destructive/35 bg-destructive/[0.025]">
        <CardHeader>
          <CardTitle className="text-destructive">Excluir conta</CardTitle>
          <CardDescription>Remove seu acesso definitivamente. Os dados dos negócios precisam permanecer sob outro administrador.</CardDescription>
        </CardHeader>
        <CardContent><DeleteAccountForm /></CardContent>
      </Card>
    </div>
  );
});
