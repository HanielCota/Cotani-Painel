import { ArrowRightIcon, CalendarDaysIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { DashboardMetricCards } from "@/components/dashboard/dashboard-metric-cards";
import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { TodayAgendaList } from "@/components/dashboard/today-agenda-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyClinicState />;
  }

  const [totalCustomers, totalServices] = await Promise.all([
    prisma.customer.count({ where: { clinicId: clinic.id } }),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a operação da {clinic.name} em tempo real.</p>
      </div>
      <DashboardMetricCards />
      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDaysIcon /> Agenda de hoje</CardTitle>
          <CardDescription>Atendimentos confirmados e pendentes do dia, atualizados automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <TodayAgendaList timeZone={clinic.timeZone} />
        </CardContent>
        <CardFooter>
          <Button nativeButton={false} render={<Link href="/dashboard/agenda" />}>
            Abrir agenda
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
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
