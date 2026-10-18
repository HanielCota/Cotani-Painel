import { addDays } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { formatDateTime } from "@/lib/formatters";
import type { OperationalCategory, OperationalStatus, Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

const PAGE_SIZE = 30;
const categories = ["all", "JOB", "WEBHOOK"] as const;
const statuses = ["all", "SUCCESS", "WARNING", "FAILURE"] as const;
const periods = ["7", "30", "all"] as const;

function pageHref(page: number, category: string, status: string, period: string) {
  const params = new URLSearchParams();
  if (category !== "all") params.set("categoria", category);
  if (status !== "all") params.set("status", status);
  if (period !== "30") params.set("periodo", period);
  if (page > 1) params.set("pagina", String(page));
  return `/admin/operacoes${params.size ? `?${params}` : ""}`;
}

function statusLabel(status: OperationalStatus) {
  return status === "SUCCESS" ? "Concluído" : status === "WARNING" ? "Atenção" : "Falhou";
}

function statusVariant(status: OperationalStatus): "default" | "outline" | "destructive" {
  return status === "SUCCESS" ? "default" : status === "WARNING" ? "outline" : "destructive";
}

function operationLabel(category: OperationalCategory, operation: string) {
  if (operation === "notification-dispatch") return "Envio de notificações";
  if (operation === "subscription-reconciliation") return "Conciliação de cobranças";
  if (operation === "subscription-expiry") return "Validade das assinaturas";
  if (operation === "data-maintenance") return "Manutenção e retenção";
  return category === "WEBHOOK" ? `Webhook Mercado Pago · ${operation}` : operation;
}

export default async function OperationsLogPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; status?: string; periodo?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const category = categories.find((value) => value === params.categoria) ?? "all";
  const status = statuses.find((value) => value === params.status) ?? "all";
  const period = periods.find((value) => value === params.periodo) ?? "30";
  const requestedPage = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const now = new Date();
  const where: Prisma.OperationalEventWhereInput = {};
  if (category !== "all") where.category = category as OperationalCategory;
  if (status !== "all") where.status = status as OperationalStatus;
  if (period !== "all") where.startedAt = { gte: addDays(now, -Number(period)) };

  const total = await prisma.operationalEvent.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const events = await prisma.operationalEvent.findMany({
    where,
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      category: true,
      operation: true,
      status: true,
      startedAt: true,
      durationMs: true,
      summary: true,
      error: true,
      externalEventId: true,
    },
  });

  return (
    <>
      <AdminPageHeader
        title="Registros operacionais"
        description="Histórico de rotinas automáticas e webhooks. Os eventos são retidos por até 30 dias; payloads completos de pagamento não são armazenados aqui."
      />
      <Card>
        <CardContent>
          <form
            method="get"
            action="/admin/operacoes"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Tipo
              <select
                name="categoria"
                defaultValue={category}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Todos</option>
                <option value="JOB">Rotinas</option>
                <option value="WEBHOOK">Webhooks</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Resultado
              <select
                name="status"
                defaultValue={status}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Todos</option>
                <option value="FAILURE">Falhou</option>
                <option value="WARNING">Atenção</option>
                <option value="SUCCESS">Concluído</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Período
              <select
                name="periodo"
                defaultValue={period}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="all">Todo o histórico disponível</option>
              </select>
            </label>
            <Button type="submit">Filtrar registros</Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {total} registro(s) encontrados. Horários exibidos no fuso de São Paulo.
      </p>
      <div className="space-y-3">
        {events.map((event) => {
          const summary =
            event.summary && typeof event.summary === "object" && !Array.isArray(event.summary)
              ? (event.summary as Record<string, unknown>)
              : {};
          const eventType = typeof summary.eventType === "string" ? summary.eventType : null;
          const httpStatus = typeof summary.httpStatus === "number" ? summary.httpStatus : null;
          return (
            <Card key={event.id}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {eventType
                        ? `Webhook Mercado Pago · ${eventType}`
                        : operationLabel(event.category, event.operation)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.category === "JOB" ? "Rotina" : "Webhook"} ·{" "}
                      {formatDateTime(event.startedAt, "America/Sao_Paulo")} · {(event.durationMs / 1000).toFixed(1)} s
                      {httpStatus ? ` · HTTP ${httpStatus}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusVariant(event.status)}>{statusLabel(event.status)}</Badge>
                </div>
                {event.externalEventId ? (
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    ID externo: {event.externalEventId}
                  </p>
                ) : null}
                {event.error ? (
                  <p className="break-words rounded-md bg-destructive/5 p-3 text-sm text-destructive">{event.error}</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!events.length ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum registro corresponde a esses filtros.
            </CardContent>
          </Card>
        ) : null}
      </div>
      <PaginationNav
        page={page}
        pageCount={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel={total === 1 ? "registro" : "registros"}
        hrefForPage={(nextPage) => pageHref(nextPage, category, status, period)}
      />
    </>
  );
}
