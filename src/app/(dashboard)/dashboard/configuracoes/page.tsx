import { SettingsIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { ServicesSettings } from "@/components/dashboard/services-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import prisma from "@/lib/prisma";
import { requireActiveClinic } from "@/server/tenant";
import type { BusinessHourItem } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyClinicState />;
  }

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
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os serviços e o expediente de {clinic.name}.</p>
      </div>

      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon />
            Configurações da clínica
          </CardTitle>
          <CardDescription>Ajuste os serviços oferecidos e os horários de funcionamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="services">
            <TabsList>
              <TabsTrigger value="services">Serviços</TabsTrigger>
              <TabsTrigger value="business-hours">Expediente</TabsTrigger>
            </TabsList>
            <TabsContent value="services" className="pt-4">
              <ServicesSettings />
            </TabsContent>
            <TabsContent value="business-hours" className="pt-4">
              <BusinessHoursSettings
                key={initialBusinessHours.map((hour) => `${hour.dayOfWeek}-${hour.isOpen}-${hour.openTime}-${hour.closeTime}-${hour.breakStart}-${hour.breakEnd}`).join("|")}
                businessHours={initialBusinessHours}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
