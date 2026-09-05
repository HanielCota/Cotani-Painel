import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Equipe" };

export default withTenant(async ({ clinic, membership }) => {
  const [members, invitations, professionals] = await Promise.all([
    prisma.membership.findMany({ where: { clinicId: clinic.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.clinicInvitation.findMany({ where: { clinicId: clinic.id, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.professional.findMany({ where: { clinicId: clinic.id, isActive: true }, select: { id: true, name: true, membershipId: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Equipe" description={`Pessoas com acesso ao painel de ${clinic.name}.`} />
      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UsersIcon />Acessos e convites</CardTitle>
          <CardDescription>Defina quem pode administrar, atender ou operar o negócio.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSettings
            members={members.map((item) => ({
              id: item.id,
              name: item.user.name,
              email: item.user.email,
              role: item.role,
              isCurrent: item.id === membership.id,
              professionalId: professionals.find((professional) => professional.membershipId === item.id)?.id ?? null,
            }))}
            invitations={invitations.map((item) => ({ id: item.id, email: item.email, role: item.role, expiresAt: item.expiresAt.toISOString(), professionalId: item.professionalId }))}
            professionals={professionals.map(({ id, name, membershipId }) => ({ id, name, available: !membershipId }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
