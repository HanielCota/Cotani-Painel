import { CalendarDaysIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { AgendaSetup } from "@/components/dashboard/agenda-setup";
import { AppointmentForm } from "@/components/dashboard/appointment-form";
import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyBarbershopState />;
  }

  const now = new Date();
  const [customers, services] = await Promise.all([
    prisma.customer.findMany({
      where: { clinicId: clinic.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { clinicId: clinic.id, isActive: true },
      select: { id: true, name: true, duration: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const minStartTime = formatClinicDateTimeInput(now, clinic.timeZone);
  const canSchedule = customers.length > 0 && services.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">Organize os próximos atendimentos de {clinic.name}.</p>
      </div>

      <AgendaSetup needsCustomers={customers.length === 0} needsServices={services.length === 0} />

      {canSchedule ? (
        <AppointmentForm customers={customers} services={services} minStartTime={minStartTime} timeZone={clinic.timeZone} />
      ) : null}

      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDaysIcon /> Próximos atendimentos</CardTitle>
          <CardDescription>Confirme, reagende ou conclua os atendimentos conforme a operação avança. A lista é atualizada automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgendaAppointmentsList timeZone={clinic.timeZone} minStartTime={minStartTime} canSchedule={canSchedule} />
        </CardContent>
      </Card>
    </div>
  );
}
