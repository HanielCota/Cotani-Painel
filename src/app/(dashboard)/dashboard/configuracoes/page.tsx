import { SettingsIcon } from "lucide-react";
import type { Metadata } from "next";

import { SettingsTabs } from "@/components/dashboard/settings-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";
import type { BusinessHourItem } from "@/types";
import { getPlanEntitlements } from "@/config/subscription-plans";

export const metadata: Metadata = { title: "Configurações" };

interface ConfiguracoesPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default withTenant<ConfiguracoesPageProps>(async ({ clinic, membership }, props) => {
  const { tab } = await props.searchParams;
  const activeTab = ["services", "professionals", "business-hours", "team", "locations"].includes(tab ?? "")
    ? tab
    : "services";

  const billingOwnerId = clinic.billingOwnerId ?? clinic.id;
  const [businessHours, members, invitations, professionals, locations] = await Promise.all([
    prisma.businessHour.findMany({ where: { clinicId: clinic.id }, orderBy: { dayOfWeek: "asc" } }),
    prisma.membership.findMany({ where: { clinicId: clinic.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.clinicInvitation.findMany({ where: { clinicId: clinic.id, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.professional.findMany({ where: { clinicId: clinic.id, isActive: true }, select: { id: true, name: true, membershipId: true }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({
      where: { userId: membership.userId, clinic: { OR: [{ id: billingOwnerId }, { billingOwnerId }] } },
      include: { clinic: true },
      orderBy: { clinic: { name: "asc" } },
    }),
  ]);

  const initialBusinessHours: BusinessHourItem[] = businessHours.map((hour) => ({
    id: hour.id,
    dayOfWeek: hour.dayOfWeek,
    isOpen: hour.isOpen,
    openTime: hour.openTime,
    closeTime: hour.closeTime,
    breakStart: hour.breakStart,
    breakEnd: hour.breakEnd,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description={`Gerencie os serviços, profissionais e o expediente de ${clinic.name}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon />
            Configurações da barbearia
          </CardTitle>
          <CardDescription>Ajuste os serviços oferecidos, profissionais e os horários de funcionamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsTabs
            defaultTab={activeTab ?? "services"}
            maxAppointmentsPerDay={clinic.maxAppointmentsPerDay}
            initialBusinessHours={initialBusinessHours}
          members={members.map((item) => ({ id: item.id, name: item.user.name, email: item.user.email, role: item.role, isCurrent: item.id === membership.id, professionalId: professionals.find((professional) => professional.membershipId === item.id)?.id ?? null }))}
          invitations={invitations.map((item) => ({ id: item.id, email: item.email, role: item.role, expiresAt: item.expiresAt.toISOString(), professionalId: item.professionalId }))}
          professionals={professionals.map(({ id, name, membershipId }) => ({ id, name, available: !membershipId }))}
          locations={locations.map(({ clinic: location }) => ({ id: location.id, name: location.name, active: location.operationalStatus === "ACTIVE" && !location.deletedAt }))}
          multipleLocationsEnabled={getPlanEntitlements(clinic.subscriptionPlan).multipleLocations}
          />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
