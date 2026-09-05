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
  const [businessHours, professionals] = await Promise.all([
    prisma.businessHour.findMany({ where: { clinicId: clinic.id }, orderBy: { dayOfWeek: "asc" } }),
    prisma.professional.findMany({ where: { clinicId: clinic.id, isActive: true }, include: { availability: { orderBy: { dayOfWeek: "asc" } } }, orderBy: { name: "asc" } }),
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
      {professionals.length ? <section className="space-y-3">
        <div><h2 className="font-semibold">Horários por profissional</h2><p className="text-sm text-muted-foreground">Abra somente quem precisa de uma disponibilidade diferente do expediente geral.</p></div>
        {professionals.map((professional) => (
          <details key={professional.id} className="group max-w-6xl overflow-hidden rounded-2xl border border-border/80 bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
              <span>{professional.name}</span><span className="text-sm font-normal text-muted-foreground group-open:hidden">Editar horários</span><span className="hidden text-sm font-normal text-muted-foreground group-open:inline">Fechar</span>
            </summary>
            <div className="border-t border-border/70 px-5 py-5"><BusinessHoursSettings professionalId={professional.id} businessHours={professional.availability.map((hour) => ({ id: hour.id, dayOfWeek: hour.dayOfWeek, isOpen: hour.isOpen, openTime: hour.openTime, closeTime: hour.closeTime, breakStart: hour.breakStart, breakEnd: hour.breakEnd }))} /></div>
          </details>
        ))}
      </section> : null}
    </div>
  );
}, ["ADMIN"]);
