import { addDays } from "date-fns";
import {
  ActivityIcon,
  Building2Icon,
  CalendarDaysIcon,
  CircleAlertIcon,
  Clock3Icon,
  ListFilterIcon,
  ShieldBanIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateTime } from "@/lib/formatters";
import { maskNotificationRecipient } from "@/lib/admin-display";
import prisma from "@/lib/prisma";

const monitoredJobs = [
  { id: "notification-dispatch", label: "Envio de notificações", staleAfterMs: 15 * 60_000 },
  { id: "subscription-reconciliation", label: "Conciliação de cobranças", staleAfterMs: 27 * 60 * 60_000 },
  { id: "subscription-expiry", label: "Validade das assinaturas", staleAfterMs: 27 * 60 * 60_000 },
  { id: "data-maintenance", label: "Manutenção e retenção", staleAfterMs: 27 * 60 * 60_000 },
] as const;

function statusLabel(status: string, stale: boolean) {
  if (stale) return "Atrasado";
  if (status === "FAILURE") return "Falhou";
  if (status === "WARNING") return "Atenção";
  return "OK";
}

function statusVariant(status: string, stale: boolean): "default" | "secondary" | "destructive" | "outline" {
  if (stale || status === "FAILURE") return "destructive";
  if (status === "WARNING") return "outline";
  return "default";
}

export default async function PlatformAdminOverviewPage() {
  const now = new Date();
  const thirtyDaysAgo = addDays(now, -30);
  const thirtyDaysAhead = addDays(now, 30);
  const sevenDaysAgo = addDays(now, -7);
  const [stores, activeStores, suspendedStores, deletedStores, customers, appointmentsCreatedRecently,
    upcomingAppointments,
    failedNotifications, failedNotificationItems, recentStores, latestJobRuns, recentWebhooks,
    webhookFailures] = await Promise.all([
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
    prisma.notification.findMany({
      where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 8,
      select: { id: true, clinicId: true, kind: true, channel: true, recipient: true, error: true, updatedAt: true,
        clinic: { select: { name: true } } },
    }),
    prisma.clinic.findMany({
      orderBy: { createdAt: "desc" }, take: 6,
      include: { _count: { select: { memberships: true, appointments: true, customers: true } } },
    }),
    Promise.all(monitoredJobs.map((job) => prisma.operationalEvent.findFirst({
      where: { category: "JOB", operation: job.id }, orderBy: { startedAt: "desc" },
      select: { status: true, startedAt: true, durationMs: true, error: true, summary: true },
    }))),
    prisma.operationalEvent.findMany({ where: { category: "WEBHOOK" }, orderBy: { startedAt: "desc" }, take: 8,
      select: { id: true, status: true, operation: true, startedAt: true, durationMs: true, error: true, summary: true, externalEventId: true } }),
    prisma.operationalEvent.count({ where: { category: "WEBHOOK", status: "FAILURE", startedAt: { gte: sevenDaysAgo } } }),
  ]);

  const metrics = [
    { label: "Lojas", value: stores, detail: "Cadastros não excluídos", icon: Building2Icon },
    { label: "Operacionais", value: activeStores, detail: "Status cadastrado como ativo", icon: ActivityIcon },
    { label: "Suspensas", value: suspendedStores, detail: "Status cadastrado como suspenso", icon: ShieldBanIcon },
    { label: "Excluídas", value: deletedStores, detail: "Cadastros marcados como excluídos", icon: CircleAlertIcon },
    { label: "Clientes", value: customers, detail: "Total de clientes cadastrados", icon: UsersIcon },
    { label: "Agendamentos criados", value: appointmentsCreatedRecently, detail: "Registros criados nos últimos 30 dias", icon: CalendarDaysIcon },
    { label: "Agendamentos próximos", value: upcomingAppointments, detail: "Pendentes ou confirmados nos próximos 30 dias", icon: CalendarDaysIcon },
  ];

  return (
    <>
      <AdminPageHeader title="Visão geral da plataforma" description={`Indicadores consultados em ${formatDateTime(now, "America/Sao_Paulo")}. “Operacionais” reflete o status cadastrado, não a disponibilidade em tempo real da loja.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, detail, icon }) => (
          <StatCard key={label} title={label} value={String(value)} description={detail} icon={icon} />
        ))}
      </div>

      <section className="space-y-4" aria-labelledby="operations-title">
        <div className="flex flex-col gap-1">
          <h2 id="operations-title" className="text-xl font-semibold tracking-tight">Saúde das rotinas</h2>
          <p className="text-sm text-muted-foreground">Última execução registrada. Falhas e atrasos ficam destacados.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/operacoes?categoria=JOB" />} variant="outline" size="sm"><ListFilterIcon />Ver histórico das rotinas</Button>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {monitoredJobs.map((job, index) => {
            const event = latestJobRuns[index];
            const stale = !event || now.getTime() - event.startedAt.getTime() > job.staleAfterMs;
            const status = event?.status ?? "WARNING";
            return (
              <Card key={job.id} className={stale || status === "FAILURE" ? "border-destructive/50" : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{job.label}</CardTitle>
                    <Badge variant={statusVariant(status, stale)}>{event ? statusLabel(status, stale) : "Sem registro"}</Badge>
                  </div>
                  <CardDescription>{event ? formatDateTime(event.startedAt, "America/Sao_Paulo") : "Aguardando a primeira execução monitorada."}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {event ? <>
                    <p className="flex items-center gap-1.5"><Clock3Icon className="size-3.5" />Duração: {(event.durationMs / 1000).toFixed(1)} s</p>
                    {event.error ? <p className="mt-2 break-words text-destructive">{event.error}</p> : null}
                  </> : <p>O status aparece após a próxima execução.</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={failedNotifications > 0 ? "border-destructive/50" : undefined}>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1.5"><CardTitle className="text-base">Notificações com falha</CardTitle>
              <CardDescription>{failedNotifications ? `${failedNotifications} registro(s) estão atualmente com status “Falhou”, sem limite de período. Abaixo, até 8 atualizados mais recentemente.` : "Nenhuma notificação está marcada como falha."}</CardDescription>
            </div>
            <Button nativeButton={false} render={<Link href="/admin/notificacoes" />} variant="outline" size="sm">Ver histórico</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedNotificationItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{item.clinic.name} · {item.channel} · {item.kind}</p>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt, "America/Sao_Paulo")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Destinatário: {maskNotificationRecipient(item.recipient)}</p>
                {item.error ? <p className="mt-1 break-words text-xs text-destructive">{item.error}</p> : null}
                <Link className="mt-2 inline-block text-xs font-medium text-primary hover:underline" href={`/admin/lojas/${item.clinicId}`}>Ver loja</Link>
              </div>
            ))}
            {!failedNotificationItems.length ? <p className="text-sm text-muted-foreground">Tudo certo por aqui.</p> : null}
          </CardContent>
        </Card>

        <Card className={webhookFailures > 0 ? "border-destructive/50" : undefined}>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1.5"><CardTitle className="text-base">Webhooks recentes</CardTitle>
              <CardDescription>{webhookFailures ? `${webhookFailures} falha(s) registrada(s) nos últimos 7 dias.` : "Nenhuma falha de webhook registrada nos últimos 7 dias."}</CardDescription>
            </div>
            <Button nativeButton={false} render={<Link href="/admin/operacoes?categoria=WEBHOOK" />} variant="outline" size="sm">Ver histórico</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentWebhooks.map((event) => {
              const summary = event.summary && typeof event.summary === "object" && !Array.isArray(event.summary)
                ? event.summary as Record<string, unknown> : {};
              return (
                <div key={event.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Mercado Pago · {String(summary.eventType ?? event.operation)}</p>
                    <Badge variant={statusVariant(event.status, false)}>{statusLabel(event.status, false)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.startedAt, "America/Sao_Paulo")} · {(event.durationMs / 1000).toFixed(1)} s</p>
                  {event.externalEventId ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Evento: {event.externalEventId}</p> : null}
                  {event.error ? <p className="mt-1 break-words text-xs text-destructive">{event.error}</p> : null}
                </div>
              );
            })}
            {!recentWebhooks.length ? <p className="text-sm text-muted-foreground">Nenhum webhook foi processado desde a ativação do monitoramento.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle>Lojas recentes</CardTitle><CardDescription>Últimas lojas sincronizadas com a plataforma.</CardDescription></div>
          <Button nativeButton={false} render={<Link href="/admin/lojas" />} variant="outline">Ver todas</Button>
        </CardHeader>
        <CardContent className="divide-y">
          {recentStores.map((clinic) => (
            <Link key={clinic.id} href={`/admin/lojas/${clinic.id}`} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{clinic.name}</p><p className="text-sm text-muted-foreground">/{clinic.slug} · {clinic._count.memberships} membros</p></div>
              <div className="flex items-center gap-2">
                {clinic.deletedAt ? <Badge variant="destructive">Excluída</Badge> : clinic.operationalStatus === "SUSPENDED" ? <Badge variant="destructive">Suspensa</Badge> : <Badge variant="success">Ativa</Badge>}
                <span className="text-sm text-muted-foreground">{clinic._count.customers} clientes · {clinic._count.appointments} atendimentos</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
