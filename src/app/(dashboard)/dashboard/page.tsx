import { ArrowRightIcon, CalendarDaysIcon, CalendarPlusIcon, LinkIcon, SettingsIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { DashboardMetricCards } from "@/components/dashboard/dashboard-metric-cards";
import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { TodayAgendaList } from "@/components/dashboard/today-agenda-list";
import { UpcomingAppointmentsList } from "@/components/dashboard/upcoming-appointments-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { isSubscriptionActive } from "@/server/subscription";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyBarbershopState />;
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const protocol = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const bookingUrl = `${protocol}://${host}/${clinic.slug}`;

  const [servicesCount, businessHoursCount] = await Promise.all([
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.businessHour.count({ where: { clinicId: clinic.id, isOpen: true } }),
  ]);

  const hasServices = servicesCount > 0;
  const hasBusinessHours = businessHoursCount > 0;
  const subscriptionActive = isSubscriptionActive(clinic);
  const showOnboarding = !subscriptionActive || !hasServices || !hasBusinessHours;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Painel de controle</h1>
        <p className="text-sm text-muted-foreground">Acompanhe a operação da {clinic.name} em tempo real.</p>
      </div>

      {showOnboarding ? (
        <OnboardingChecklist
          bookingUrl={bookingUrl}
          hasServices={hasServices}
          hasBusinessHours={hasBusinessHours}
          isSubscriptionActive={subscriptionActive}
        />
      ) : null}

      <DashboardMetricCards />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 shadow-sm" size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <LinkIcon className="size-4 text-primary" />
              Link de agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CardDescription className="text-xs">
              É por esse endereço que seus clientes acessam o agendamento público.
            </CardDescription>
            <CopyBookingLink url={bookingUrl} />
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm" size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarPlusIcon className="size-4 text-primary" />
              Nova venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">Registre um agendamento ou atendimento rápido.</CardDescription>
          </CardContent>
          <CardFooter className="pt-0">
            <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} size="sm" className="w-full">
              Abrir agenda
              <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>

        <Card className="border border-border/80 shadow-sm" size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <SettingsIcon className="size-4 text-primary" />
              Configurar horários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">Ajuste serviços, expediente e regras de negócio.</CardDescription>
          </CardContent>
          <CardFooter className="pt-0">
            <Button nativeButton={false} render={<Link href="/dashboard/configuracoes" />} size="sm" className="w-full">
              Abrir configurações
              <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Próximos agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingAppointmentsList timeZone={clinic.timeZone} />
          </CardContent>
          <CardFooter>
            <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="outline" size="sm">
              Ver agenda completa
              <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>

        <Card className="border border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Agenda de hoje
            </CardTitle>
            <CardDescription>Atendimentos confirmados e pendentes do dia.</CardDescription>
          </CardHeader>
          <CardContent>
            <TodayAgendaList timeZone={clinic.timeZone} />
          </CardContent>
          <CardFooter>
            <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="outline" size="sm">
              Abrir agenda
              <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
