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
import {
  DashboardMetricCards,
  DashboardMetricCardsSkeleton,
} from "@/components/dashboard/dashboard-metric-cards";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { NavCard } from "@/components/ui/nav-card";
import {
  TodayAgendaList,
  TodayAgendaListSkeleton,
} from "@/components/dashboard/today-agenda-list";
import {
  UpcomingAppointmentsList,
  UpcomingAppointmentsListSkeleton,
} from "@/components/dashboard/upcoming-appointments-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { getPublicBookingUrl } from "@/lib/url";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Visão geral" };

export default withTenant(async ({ clinic }) => {
  const [bookingUrl, servicesCount, businessHoursCount, professionalsCount, appointmentsCount] = await Promise.all([
    getPublicBookingUrl(clinic.slug),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.businessHour.count({ where: { clinicId: clinic.id, isOpen: true } }),
    prisma.professional.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
  ]);

  const hasServices = servicesCount > 0;
  const hasBusinessHours = businessHoursCount > 0;
  const hasProfessionals = professionalsCount > 0;
  const hasAppointments = appointmentsCount > 0;
  const subscriptionActive = isSubscriptionActive(clinic);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel de controle"
        subtitle={new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: clinic.timeZone }).format(new Date())}
        description={`Acompanhe a operação da ${clinic.name} em tempo real.`}
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/agenda" />}>
            <CalendarPlusIcon data-icon="inline-start" />
            Novo atendimento
          </Button>
        }
      />

      <OnboardingChecklist
        bookingUrl={bookingUrl}
        linkSharedOnServer={clinic.bookingLinkSharedAt !== null}
        hasServices={hasServices}
        hasBusinessHours={hasBusinessHours}
        hasProfessionals={hasProfessionals}
        hasAppointments={hasAppointments}
        isSubscriptionActive={subscriptionActive}
      />

      <Suspense fallback={<DashboardMetricCardsSkeleton />}>
        <DashboardMetricCards clinic={clinic} />
      </Suspense>

      <section className="space-y-3">
        <SectionHeader title="Ações rápidas" description="Atalhos para as tarefas mais frequentes." />
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LinkIcon className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium">Link de agendamento</h3>
                <p className="text-xs leading-5 text-muted-foreground">Compartilhe o endereço público do seu negócio.</p>
              </div>
            </div>
            <CopyBookingLink url={bookingUrl} />
          </div>

          <NavCard href="/dashboard/negocio/horarios" icon={SettingsIcon} title="Configurar horários" description="Ajuste o expediente e as regras da agenda." />
          <NavCard
            href="/dashboard/negocio/servicos"
            icon={TagIcon}
            title="Serviços"
            description={`${servicesCount} serviço${servicesCount === 1 ? "" : "s"} ativo${servicesCount === 1 ? "" : "s"}.`}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Agenda de hoje
            </CardTitle>
            <CardDescription>Atendimentos confirmados e pendentes do dia.</CardDescription>
            <CardAction>
              <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="ghost" size="sm">
                Abrir agenda
                <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<TodayAgendaListSkeleton />}>
              <TodayAgendaList timeZone={clinic.timeZone} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-5 text-primary" />
              Próximos agendamentos
            </CardTitle>
            <CardDescription>Os próximos horários da sua operação.</CardDescription>
            <CardAction>
              <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="ghost" size="sm">
                Ver todos
                <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<UpcomingAppointmentsListSkeleton />}>
              <UpcomingAppointmentsList timeZone={clinic.timeZone} limit={5} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}, ["ADMIN", "RECEPTIONIST"]);
