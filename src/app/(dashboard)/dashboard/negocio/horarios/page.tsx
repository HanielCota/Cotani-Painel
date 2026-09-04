import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import { ClinicSettings } from "@/components/dashboard/clinic-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";
import type { BusinessHourItem } from "@/types";

export const metadata: Metadata = { title: "Horários" };

export default withTenant(async ({ clinic }) => {
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
      <PageHeader title="Horários" description={`Expediente e capacidade de atendimento de ${clinic.name}.`} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDaysIcon />Expediente</CardTitle>
          <CardDescription>Defina quando novos agendamentos podem ser realizados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ClinicSettings maxAppointmentsPerDay={clinic.maxAppointmentsPerDay} />
          <BusinessHoursSettings
            key={initialBusinessHours.map((hour) => `${hour.dayOfWeek}-${hour.isOpen}-${hour.openTime}-${hour.closeTime}-${hour.breakStart}-${hour.breakEnd}`).join("|")}
            businessHours={initialBusinessHours}
          />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
