import { CalendarDaysIcon, Clock3Icon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AgendaSetup } from "@/components/dashboard/agenda-setup";
import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { AppointmentForm } from "@/components/dashboard/appointment-form";
import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda" };

const statusLabel = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
} as const;

export default async function AgendaPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyClinicState />;
  }

  const now = new Date();
  const [appointments, customers, services] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: now },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: {
        customer: true,
        service: true,
      },
      orderBy: {
        startTime: "asc",
      },
      take: 50,
    }),
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
          <CardDescription>{appointments.length ? "Confirme, reagende ou conclua os atendimentos conforme a operação avança." : "Os próximos atendimentos aparecerão aqui."}</CardDescription>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <Empty className="min-h-48 border-0 bg-muted/30">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Clock3Icon /></EmptyMedia>
                <EmptyTitle>Nenhum atendimento futuro</EmptyTitle>
                <EmptyDescription>{canSchedule ? "Use o formulário acima para registrar o primeiro horário." : "Cadastre os itens necessários acima para começar."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col divide-y">
              {appointments.map((appointment) => {
                const dateTime = new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: clinic.timeZone,
                }).format(appointment.startTime);

                return (
                  <div key={appointment.id} className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{appointment.customer.name}</p>
                      <p className="text-sm text-muted-foreground">{appointment.service.name} · {dateTime}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Badge variant={appointment.status === "CONFIRMED" ? "default" : "secondary"}>{statusLabel[appointment.status]}</Badge>
                      <RescheduleAppointmentDialog appointmentId={appointment.id} currentStartTime={formatClinicDateTimeInput(appointment.startTime, clinic.timeZone)} minStartTime={minStartTime} />
                      <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
