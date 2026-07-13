import { ArrowRightIcon, CalendarCheck2Icon, CircleAlertIcon, Clock3Icon, UsersIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyClinicState />;
  }

  const { startOfToday, startOfTomorrow, startOfMonth } = getClinicDateBounds(clinic.timeZone);

  const [totalAppointments, confirmedToday, noShowsThisMonth, totalCustomers, totalServices] = await Promise.all([
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
    prisma.appointment.count({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfToday, lt: startOfTomorrow },
        status: "CONFIRMED",
      },
    }),
    prisma.appointment.count({
      where: {
        clinicId: clinic.id,
        status: "NO_SHOW",
        startTime: { gte: startOfMonth },
      },
    }),
    prisma.customer.count({ where: { clinicId: clinic.id } }),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a operação da {clinic.name} em tempo real.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Agendamentos totais" value={String(totalAppointments)} description="Histórico da clínica" icon={CalendarCheck2Icon} />
        <MetricCard title="Confirmados hoje" value={String(confirmedToday)} description="Com confirmação registrada" icon={Clock3Icon} />
        <MetricCard title="No-shows no mês" value={String(noShowsThisMonth)} description="Para acompanhar de perto" icon={CircleAlertIcon} />
        <MetricCard title="Clientes" value={String(totalCustomers)} description="Base ativa da clínica" icon={UsersIcon} />
      </section>
      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Próximo passo</CardTitle>
          <CardDescription>Cadastre clientes e serviços, depois agende o próximo atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Você tem {totalCustomers} cliente{totalCustomers === 1 ? "" : "s"} e {totalServices} serviço{totalServices === 1 ? "" : "s"} ativo{totalServices === 1 ? "" : "s"} cadastrados.
        </CardContent>
        <CardFooter>
          <Button nativeButton={false} render={<Link href="/dashboard/agenda" />}>
            Preparar agenda
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
