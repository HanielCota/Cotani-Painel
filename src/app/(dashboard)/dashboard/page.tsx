import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  LinkIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react";

import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import {
  DashboardMetricCards,
  DashboardMetricCardsSkeleton,
} from "@/components/dashboard/dashboard-metric-cards";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import {
  TodayAgendaList,
  TodayAgendaListSkeleton,
} from "@/components/dashboard/today-agenda-list";
import {
  UpcomingAppointmentsList,
  UpcomingAppointmentsListSkeleton,
} from "@/components/dashboard/upcoming-appointments-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { getPublicBookingUrl } from "@/lib/url";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Visão geral" };

export default withTenant(async ({ clinic }) => {
  const bookingUrl = await getPublicBookingUrl(clinic.slug);

  const [servicesCount, businessHoursCount] = await Promise.all([
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.businessHour.count({ where: { clinicId: clinic.id, isOpen: true } }),
  ]);

  const hasServices = servicesCount > 0;
  const hasBusinessHours = businessHoursCount > 0;
  const subscriptionActive = isSubscriptionActive(clinic);
  const showOnboarding = !subscriptionActive || !hasServices || !hasBusinessHours;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Painel de controle</h1>
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

      <Suspense fallback={<DashboardMetricCardsSkeleton />}>
        <DashboardMetricCards clinic={clinic} />
      </Suspense>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          icon={LinkIcon}
          title="Link de agendamento"
          description="Endereço público que seus clientes usam para agendar."
        >
          <CopyBookingLink url={bookingUrl} />
        </DashboardCard>

        <DashboardCard
          icon={CalendarPlusIcon}
          title="Nova venda"
          description="Registre um agendamento ou atendimento rápido."
        >
          <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} size="sm" className="w-full">
            Abrir agenda
            <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
          </Button>
        </DashboardCard>

        <DashboardCard
          icon={SettingsIcon}
          title="Configurar horários"
          description="Ajuste serviços, expediente e regras de negócio."
        >
          <Button nativeButton={false} render={<Link href="/dashboard/configuracoes" />} size="sm" className="w-full">
            Abrir configurações
            <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
          </Button>
        </DashboardCard>

        <DashboardCard
          icon={TagIcon}
          title="Serviços"
          description={`${servicesCount} serviço${servicesCount === 1 ? "" : "s"} ativo${servicesCount === 1 ? "" : "s"} cadastrado${servicesCount === 1 ? "" : "s"}.`}
        >
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/configuracoes" />}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Gerenciar
            <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
          </Button>
        </DashboardCard>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Próximos agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<UpcomingAppointmentsListSkeleton />}>
              <UpcomingAppointmentsList clinic={clinic} />
            </Suspense>
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
            <Suspense fallback={<TodayAgendaListSkeleton />}>
              <TodayAgendaList clinic={clinic} />
            </Suspense>
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
});
