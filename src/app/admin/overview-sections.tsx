import type { LucideIcon } from "lucide-react";
import { Clock3Icon, ListFilterIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import type { Clinic, Notification, OperationalEvent } from "@/generated/prisma/client";
import { maskNotificationRecipient } from "@/lib/admin-display";
import { formatDateTime } from "@/lib/formatters";
import { StoreStatusBadge } from "@/app/admin/store-status-badge";

export interface MonitoredJob {
  id: string;
  label: string;
  staleAfterMs: number;
}

export type JobRunEvent = Pick<OperationalEvent, "status" | "startedAt" | "durationMs" | "error" | "summary">;

export interface JobRun {
  job: MonitoredJob;
  event: JobRunEvent | null;
}

export interface OverviewMetric {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
}

type FailedNotificationItem = Pick<
  Notification,
  "id" | "clinicId" | "kind" | "channel" | "recipient" | "error" | "updatedAt"
> & { clinic: { name: string } };

type WebhookEvent = Pick<
  OperationalEvent,
  "id" | "status" | "operation" | "startedAt" | "durationMs" | "error" | "summary" | "externalEventId"
>;

type RecentStore = Clinic & { _count: { memberships: number; appointments: number; customers: number } };

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

function formatDurationSeconds(durationMs: number) {
  return (durationMs / 1000).toFixed(1);
}

export function OverviewMetricsGrid({ metrics }: { metrics: OverviewMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(({ label, value, detail, icon }) => (
        <StatCard key={label} title={label} value={String(value)} description={detail} icon={icon} />
      ))}
    </div>
  );
}

function isJobRunStale(jobRun: JobRun, now: Date) {
  if (!jobRun.event) return true;
  return now.getTime() - jobRun.event.startedAt.getTime() > jobRun.job.staleAfterMs;
}

function JobRunDetails({ event }: { event: JobRunEvent | null }) {
  if (!event) {
    return <p>O status aparece após a próxima execução.</p>;
  }

  return (
    <>
      <p className="flex items-center gap-1.5">
        <Clock3Icon className="size-3.5" />
        Duração: {formatDurationSeconds(event.durationMs)} s
      </p>
      {event.error ? <p className="mt-2 break-words text-destructive">{event.error}</p> : null}
    </>
  );
}

function JobHealthCard({ jobRun, now }: { jobRun: JobRun; now: Date }) {
  const { job, event } = jobRun;
  const stale = isJobRunStale(jobRun, now);
  const status = event?.status ?? "WARNING";

  return (
    <Card className={stale || status === "FAILURE" ? "border-destructive/50" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{job.label}</CardTitle>
          <Badge variant={statusVariant(status, stale)}>
            {event ? statusLabel(status, stale) : "Sem registro"}
          </Badge>
        </div>
        <CardDescription>
          {event
            ? formatDateTime(event.startedAt, "America/Sao_Paulo")
            : "Aguardando a primeira execução monitorada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <JobRunDetails event={event} />
      </CardContent>
    </Card>
  );
}

export function JobHealthSection({ jobRuns, now }: { jobRuns: JobRun[]; now: Date }) {
  return (
    <section className="space-y-4" aria-labelledby="operations-title">
      <div className="flex flex-col gap-1">
        <h2 id="operations-title" className="text-xl font-semibold tracking-tight">
          Saúde das rotinas
        </h2>
        <p className="text-sm text-muted-foreground">
          Última execução registrada. Falhas e atrasos ficam destacados.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/admin/operacoes?categoria=JOB" />} variant="outline" size="sm">
        <ListFilterIcon />
        Ver histórico das rotinas
      </Button>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {jobRuns.map((jobRun) => (
          <JobHealthCard key={jobRun.job.id} jobRun={jobRun} now={now} />
        ))}
      </div>
    </section>
  );
}

function FailedNotificationEntry({ item }: { item: FailedNotificationItem }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {item.clinic.name} · {item.channel} · {item.kind}
        </p>
        <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt, "America/Sao_Paulo")}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Destinatário: {maskNotificationRecipient(item.recipient)}</p>
      {item.error ? <p className="mt-1 break-words text-xs text-destructive">{item.error}</p> : null}
      <Link
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
        href={`/admin/lojas/${item.clinicId}`}
      >
        Ver negócio
      </Link>
    </div>
  );
}

function failedNotificationsDescription(failedCount: number) {
  if (!failedCount) return "Nenhuma notificação está marcada como falha.";
  return `${failedCount} registro(s) estão atualmente com status “Falhou”, sem limite de período. Abaixo, até 8 atualizados mais recentemente.`;
}

export function FailedNotificationsCard({
  failedCount,
  items,
}: {
  failedCount: number;
  items: FailedNotificationItem[];
}) {
  return (
    <Card className={failedCount > 0 ? "border-destructive/50" : undefined}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Notificações com falha</CardTitle>
          <CardDescription>{failedNotificationsDescription(failedCount)}</CardDescription>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/notificacoes" />} variant="outline" size="sm">
          Ver histórico
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <FailedNotificationEntry key={item.id} item={item} />
        ))}
        {!items.length ? <p className="text-sm text-muted-foreground">Tudo certo por aqui.</p> : null}
      </CardContent>
    </Card>
  );
}

function webhookSummaryRecord(summary: WebhookEvent["summary"]): Record<string, unknown> {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return {};
  return summary as Record<string, unknown>;
}

function WebhookEventEntry({ event }: { event: WebhookEvent }) {
  const summary = webhookSummaryRecord(event.summary);

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Mercado Pago · {String(summary.eventType ?? event.operation)}</p>
        <Badge variant={statusVariant(event.status, false)}>{statusLabel(event.status, false)}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDateTime(event.startedAt, "America/Sao_Paulo")} · {formatDurationSeconds(event.durationMs)} s
      </p>
      {event.externalEventId ? (
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Evento: {event.externalEventId}</p>
      ) : null}
      {event.error ? <p className="mt-1 break-words text-xs text-destructive">{event.error}</p> : null}
    </div>
  );
}

function webhookFailuresDescription(failureCount: number) {
  if (!failureCount) return "Nenhuma falha de webhook registrada nos últimos 7 dias.";
  return `${failureCount} falha(s) registrada(s) nos últimos 7 dias.`;
}

export function RecentWebhooksCard({ failureCount, events }: { failureCount: number; events: WebhookEvent[] }) {
  return (
    <Card className={failureCount > 0 ? "border-destructive/50" : undefined}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Webhooks recentes</CardTitle>
          <CardDescription>{webhookFailuresDescription(failureCount)}</CardDescription>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/admin/operacoes?categoria=WEBHOOK" />}
          variant="outline"
          size="sm"
        >
          Ver histórico
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <WebhookEventEntry key={event.id} event={event} />
        ))}
        {!events.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum webhook foi processado desde a ativação do monitoramento.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecentStoreRow({ clinic }: { clinic: RecentStore }) {
  return (
    <Link
      href={`/admin/lojas/${clinic.id}`}
      className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium">{clinic.name}</p>
        <p className="text-sm text-muted-foreground">
          /{clinic.slug} · {clinic._count.memberships} membros
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StoreStatusBadge clinic={clinic} />
        <span className="text-sm text-muted-foreground">
          {clinic._count.customers} clientes · {clinic._count.appointments} atendimentos
        </span>
      </div>
    </Link>
  );
}

export function RecentStoresCard({ stores }: { stores: RecentStore[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Negócios recentes</CardTitle>
          <CardDescription>Últimos negócios cadastrados na plataforma.</CardDescription>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/lojas" />} variant="outline">
          Ver todas
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        {stores.map((clinic) => (
          <RecentStoreRow key={clinic.id} clinic={clinic} />
        ))}
      </CardContent>
    </Card>
  );
}
