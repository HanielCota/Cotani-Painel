import Link from "next/link";

import { parsePageNumber } from "@/lib/page-number";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminActionLabel, adminTargetLabel } from "@/lib/display-labels";
import { formatDateTime } from "@/lib/formatters";
import prisma from "@/lib/prisma";
import { PaginationNav } from "@/components/ui/pagination-nav";

const PAGE_SIZE = 30;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams;
  const requestedPage = parsePageNumber(params.pagina);
  const total = await prisma.adminAuditLog.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const events = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { clinic: { select: { id: true, name: true } } },
  });

  return (
    <>
      <AdminPageHeader title="Auditoria" description="Histórico imutável das ações administrativas sensíveis." />
      <Card className="overflow-hidden"><CardContent className="px-0">
        <Table>
          <TableHeader className="bg-muted/40"><TableRow><TableHead className="pl-6">Data</TableHead><TableHead>Ação</TableHead><TableHead>Negócio / alvo</TableHead><TableHead>Motivo</TableHead><TableHead className="pr-6">Responsável</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="pl-6">{formatDateTime(event.createdAt, "America/Sao_Paulo")}</TableCell>
                <TableCell><Badge variant="outline">{adminActionLabel(event.action)}</Badge></TableCell>
                <TableCell>{event.clinic ? <Link className="font-medium hover:underline" href={`/admin/lojas/${event.clinic.id}`}>{event.clinic.name}</Link> : <span>{adminTargetLabel(event.targetType)}: {event.targetId}</span>}</TableCell>
                <TableCell className="max-w-72 whitespace-normal text-muted-foreground">{event.reason ?? "-"}</TableCell>
                <TableCell className="pr-6 font-mono text-xs">{event.actorAuthUserId}</TableCell>
              </TableRow>
            ))}
            {!events.length ? <TableRow><TableCell colSpan={5} className="py-16 text-center text-muted-foreground">Nenhuma ação administrativa registrada.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent></Card>
      <PaginationNav page={page} pageCount={totalPages} totalItems={total} pageSize={PAGE_SIZE} itemLabel={total === 1 ? "evento" : "eventos"} hrefForPage={(nextPage) => `/admin/auditoria?pagina=${nextPage}`} />
    </>
  );
}
