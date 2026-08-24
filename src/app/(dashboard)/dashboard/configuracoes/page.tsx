import { SettingsIcon } from "lucide-react";
import type { Metadata } from "next";

import { SettingsTabs } from "@/components/dashboard/settings-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";
import type { BusinessHourItem } from "@/types";

export const metadata: Metadata = { title: "Configurações" };

interface ConfiguracoesPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default withTenant<ConfiguracoesPageProps>(async ({ clinic }, props) => {
  const { tab } = await props.searchParams;
  const activeTab = ["services", "professionals", "business-hours"].includes(tab ?? "")
    ? tab
    : "services";

  const businessHours = await prisma.businessHour.findMany({
    where: { clinicId: clinic.id },
    orderBy: { dayOfWeek: "asc" },
  });

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
          />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
