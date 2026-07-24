import { SettingsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import { ClinicSettings } from "@/components/dashboard/clinic-settings";
import { ProfessionalsSettings } from "@/components/dashboard/professionals-settings";
import { ServicesSettings } from "@/components/dashboard/services-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os serviços, profissionais e o expediente de {clinic.name}.</p>
      </div>

      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon />
            Configurações da barbearia
          </CardTitle>
          <CardDescription>Ajuste os serviços oferecidos, profissionais e os horários de funcionamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab}>
            <div className="overflow-x-auto pb-1 -mb-1">
              <TabsList className="w-full min-w-fit sm:w-fit">
                <TabsTrigger value="services">Serviços</TabsTrigger>
                <TabsTrigger value="professionals" className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5" />
                  Profissionais
                </TabsTrigger>
                <TabsTrigger value="business-hours">Expediente</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="services" className="pt-4">
              <ServicesSettings />
            </TabsContent>
            <TabsContent value="professionals" className="pt-4">
              <ProfessionalsSettings />
            </TabsContent>
            <TabsContent value="business-hours" className="pt-4">
              <div className="flex flex-col gap-6">
                <ClinicSettings maxAppointmentsPerDay={clinic.maxAppointmentsPerDay} />
                <BusinessHoursSettings
                  key={initialBusinessHours.map((hour) => `${hour.dayOfWeek}-${hour.isOpen}-${hour.openTime}-${hour.closeTime}-${hour.breakStart}-${hour.breakEnd}`).join("|")}
                  businessHours={initialBusinessHours}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
});
