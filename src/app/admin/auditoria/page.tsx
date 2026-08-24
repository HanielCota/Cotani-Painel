import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminActionLabel, adminTargetLabel } from "@/lib/display-labels";
import prisma from "@/lib/prisma";

const PAGE_SIZE = 30;
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
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
          <TableHeader className="bg-muted/40"><TableRow><TableHead className="pl-6">Data</TableHead><TableHead>Ação</TableHead><TableHead>Loja / alvo</TableHead><TableHead>Motivo</TableHead><TableHead className="pr-6">Responsável</TableHead></TableRow></TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="pl-6">{dateFormatter.format(event.createdAt)}</TableCell>
                <TableCell><Badge variant="outline">{adminActionLabel(event.action)}</Badge></TableCell>
                <TableCell>{event.clinic ? <Link className="font-medium hover:underline" href={`/admin/lojas/${event.clinic.id}`}>{event.clinic.name}</Link> : <span>{adminTargetLabel(event.targetType)}: {event.targetId}</span>}</TableCell>
                <TableCell className="max-w-72 whitespace-normal text-muted-foreground">{event.reason ?? "—"}</TableCell>
                <TableCell className="pr-6 font-mono text-xs">{event.actorClerkUserId}</TableCell>
              </TableRow>
            ))}
            {!events.length ? <TableRow><TableCell colSpan={5} className="py-16 text-center text-muted-foreground">Nenhuma ação administrativa registrada.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </CardContent></Card>
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>{total} eventos · página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} nativeButton={page <= 1} render={page > 1 ? <Link href={`/admin/auditoria?pagina=${page - 1}`} /> : undefined}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} nativeButton={page >= totalPages} render={page < totalPages ? <Link href={`/admin/auditoria?pagina=${page + 1}`} /> : undefined}>Próxima</Button>
        </div>
      </div>
    </>
  );
}
