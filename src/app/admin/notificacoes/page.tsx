import { addDays } from "date-fns";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { formatDateTime } from "@/lib/formatters";
import { maskNotificationRecipient } from "@/lib/admin-display";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 25;
const periods = ["7", "30", "all"] as const;

function pageHref(page: number, period: string) {
  const params = new URLSearchParams();
  if (period !== "30") params.set("periodo", period);
  if (page > 1) params.set("pagina", String(page));
  return `/admin/notificacoes${params.size ? `?${params}` : ""}`;
}

export default async function FailedNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const period = periods.includes(params.periodo as (typeof periods)[number]) ? params.periodo! : "30";
  const requestedPage = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const where: Prisma.NotificationWhereInput = { status: "FAILED" };
  if (period !== "all") where.updatedAt = { gte: addDays(new Date(), -Number(period)) };

  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, clinicId: true, kind: true, channel: true, status: true, recipient: true,
      attempts: true, maxAttempts: true, error: true, scheduledFor: true, updatedAt: true,
      clinic: { select: { name: true } },
    },
  });

  return (
    <>
      <AdminPageHeader title="Falhas de notificações" description="Mensagens atualmente marcadas como falha. O destinatário é parcialmente ocultado; nenhuma ação de reenvio é executada pelo painel global." />
      <Card>
        <CardContent>
          <form method="get" action="/admin/notificacoes" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-xs font-medium text-muted-foreground">Período da última atualização
              <select name="periodo" defaultValue={period} className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
                <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="all">Todo o histórico retido</option>
              </select>
            </label>
            <Button type="submit">Filtrar falhas</Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{total} notificação(ões) com falha nesse período. Horários exibidos no fuso de São Paulo.</p>
      <div className="space-y-3">
        {notifications.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium">{item.clinic.name} · {item.channel} · {item.kind.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">Destinatário: {maskNotificationRecipient(item.recipient)} · Tentativas: {item.attempts}/{item.maxAttempts}</p>
                  <p className="text-xs text-muted-foreground">Atualizada: {formatDateTime(item.updatedAt, "America/Sao_Paulo")} · Programada: {formatDateTime(item.scheduledFor, "America/Sao_Paulo")}</p>
                </div>
                <Badge variant="destructive">Falhou</Badge>
              </div>
              {item.error ? <p className="break-words rounded-md bg-destructive/5 p-3 text-sm text-destructive">{item.error}</p> : null}
              <Link className="inline-block text-sm font-medium text-primary hover:underline" href={`/admin/lojas/${item.clinicId}`}>Ver loja</Link>
            </CardContent>
          </Card>
        ))}
        {!notifications.length ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma falha encontrada nesse período.</CardContent></Card> : null}
      </div>
      <PaginationNav page={page} pageCount={totalPages} totalItems={total} pageSize={PAGE_SIZE} itemLabel={total === 1 ? "notificação" : "notificações"} hrefForPage={(nextPage) => pageHref(nextPage, period)} />
    </>
  );
}
