import { addDays } from "date-fns";
import {
  ActivityIcon,
  Building2Icon,
  CalendarDaysIcon,
  CircleAlertIcon,
  ShieldBanIcon,
  UsersIcon,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatDateTime } from "@/lib/formatters";
import prisma from "@/lib/prisma";

import {
  FailedNotificationsCard,
  JobHealthSection,
  OverviewMetricsGrid,
  RecentStoresCard,
  RecentWebhooksCard,
  type JobRun,
  type JobRunEvent,
  type OverviewMetric,
} from "./overview-sections";

const monitoredJobs = [
  { id: "notification-dispatch", label: "Envio de notificações", staleAfterMs: 15 * 60_000 },
  { id: "subscription-reconciliation", label: "Conciliação de cobranças", staleAfterMs: 27 * 60 * 60_000 },
  { id: "subscription-expiry", label: "Validade das assinaturas", staleAfterMs: 27 * 60 * 60_000 },
  { id: "data-maintenance", label: "Manutenção e retenção", staleAfterMs: 27 * 60 * 60_000 },
] as const;

interface OverviewCounts {
  stores: number;
  activeStores: number;
  suspendedStores: number;
  deletedStores: number;
  customers: number;
  appointmentsCreatedRecently: number;
  upcomingAppointments: number;
}

function findFailedNotificationItems() {
  return prisma.notification.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      clinicId: true,
      kind: true,
      channel: true,
      recipient: true,
      error: true,
      updatedAt: true,
      clinic: { select: { name: true } },
    },
  });
}

function findRecentStores() {
  return prisma.clinic.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { _count: { select: { memberships: true, appointments: true, customers: true } } },
  });
}

function findLatestJobRuns() {
  return Promise.all(
    monitoredJobs.map((job) =>
      prisma.operationalEvent.findFirst({
        where: { category: "JOB", operation: job.id },
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true, durationMs: true, error: true, summary: true },
      }),
    ),
  );
}

function findRecentWebhooks() {
  return prisma.operationalEvent.findMany({
    where: { category: "WEBHOOK" },
    orderBy: { startedAt: "desc" },
    take: 8,
    select: {
      id: true,
      status: true,
      operation: true,
      startedAt: true,
      durationMs: true,
      error: true,
      summary: true,
      externalEventId: true,
    },
  });
}

async function loadPlatformOverview(now: Date) {
  const thirtyDaysAgo = addDays(now, -30);
  const thirtyDaysAhead = addDays(now, 30);
  const sevenDaysAgo = addDays(now, -7);
  const [
    stores,
    activeStores,
    suspendedStores,
    deletedStores,
    customers,
    appointmentsCreatedRecently,
    upcomingAppointments,
    failedNotifications,
    failedNotificationItems,
    recentStores,
    latestJobRuns,
    recentWebhooks,
    webhookFailures,
  ] = await Promise.all([
    prisma.clinic.count({ where: { deletedAt: null } }),
    prisma.clinic.count({ where: { deletedAt: null, operationalStatus: "ACTIVE" } }),
    prisma.clinic.count({ where: { deletedAt: null, operationalStatus: "SUSPENDED" } }),
    prisma.clinic.count({ where: { deletedAt: { not: null } } }),
    prisma.customer.count(),
    prisma.appointment.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.appointment.count({
      where: {
        startTime: { gte: now, lt: thirtyDaysAhead },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    findFailedNotificationItems(),
    findRecentStores(),
    findLatestJobRuns(),
    findRecentWebhooks(),
    prisma.operationalEvent.count({
      where: { category: "WEBHOOK", status: "FAILURE", startedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const counts: OverviewCounts = {
    stores,
    activeStores,
    suspendedStores,
    deletedStores,
    customers,
    appointmentsCreatedRecently,
    upcomingAppointments,
  };

  return {
    counts,
    failedNotifications,
    failedNotificationItems,
    recentStores,
    latestJobRuns,
    recentWebhooks,
    webhookFailures,
  };
}

function buildOverviewMetrics(counts: OverviewCounts): OverviewMetric[] {
  return [
    { label: "Negócios", value: counts.stores, detail: "Cadastros não excluídos", icon: Building2Icon },
    { label: "Operacionais", value: counts.activeStores, detail: "Status cadastrado como ativo", icon: ActivityIcon },
    {
      label: "Suspensas",
      value: counts.suspendedStores,
      detail: "Status cadastrado como suspenso",
      icon: ShieldBanIcon,
    },
    {
      label: "Excluídas",
      value: counts.deletedStores,
      detail: "Cadastros marcados como excluídos",
      icon: CircleAlertIcon,
    },
    { label: "Clientes", value: counts.customers, detail: "Total de clientes cadastrados", icon: UsersIcon },
    {
      label: "Agendamentos criados",
      value: counts.appointmentsCreatedRecently,
      detail: "Registros criados nos últimos 30 dias",
      icon: CalendarDaysIcon,
    },
    {
      label: "Agendamentos próximos",
      value: counts.upcomingAppointments,
      detail: "Pendentes ou confirmados nos próximos 30 dias",
      icon: CalendarDaysIcon,
    },
  ];
}

function pairJobsWithLatestRuns(latestJobRuns: Array<JobRunEvent | null>): JobRun[] {
  return monitoredJobs.map((job, index) => ({ job, event: latestJobRuns[index] ?? null }));
}

export default async function PlatformAdminOverviewPage() {
  const now = new Date();
  const overview = await loadPlatformOverview(now);

  return (
    <>
      <AdminPageHeader
        title="Visão geral da plataforma"
        description={`Indicadores consultados em ${formatDateTime(now, "America/Sao_Paulo")}. “Operacionais” reflete o status cadastrado, não a disponibilidade em tempo real do negócio.`}
      />

      <OverviewMetricsGrid metrics={buildOverviewMetrics(overview.counts)} />

      <JobHealthSection jobRuns={pairJobsWithLatestRuns(overview.latestJobRuns)} now={now} />

      <div className="grid gap-6 xl:grid-cols-2">
        <FailedNotificationsCard
          failedCount={overview.failedNotifications}
          items={overview.failedNotificationItems}
        />

        <RecentWebhooksCard failureCount={overview.webhookFailures} events={overview.recentWebhooks} />
      </div>

      <RecentStoresCard stores={overview.recentStores} />
    </>
  );
}
