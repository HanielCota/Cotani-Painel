import { Building2Icon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { parsePageNumber } from "@/lib/page-number";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { subscriptionPlanLabel } from "@/lib/display-labels";
import prisma from "@/lib/prisma";

const PAGE_SIZE = 20;
const filters = [
  ["all", "Todas"],
  ["active", "Ativas"],
  ["suspended", "Suspensas"],
  ["deleted", "Excluídas"],
] as const;

function pageHref(page: number, query: string, filter: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filtro", filter);
  if (page > 1) params.set("pagina", String(page));
  return `/admin/lojas${params.size ? `?${params}` : ""}`;
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const filter = filters.find(([value]) => value === params.filtro)?.[0] ?? "all";
  const requestedPage = parsePageNumber(params.pagina);
  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filter === "active" ? { deletedAt: null, operationalStatus: "ACTIVE" as const } : {}),
    ...(filter === "suspended" ? { deletedAt: null, operationalStatus: "SUSPENDED" as const } : {}),
    ...(filter === "deleted" ? { deletedAt: { not: null } } : {}),
  };
  const total = await prisma.clinic.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const clinics = await prisma.clinic.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { _count: { select: { memberships: true, customers: true, appointments: true } } },
  });

  return (
    <>
      <AdminPageHeader
        title="Negócios"
        description="Pesquise, inspecione e controle o acesso dos negócios à plataforma."
      />

      <Card>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row" action="/admin/lojas">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query} placeholder="Nome ou endereço do negócio" className="pl-9" />
            </div>
            {filter !== "all" ? <input type="hidden" name="filtro" value={filter} /> : null}
            <Button type="submit">Pesquisar</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {filters.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                nativeButton={false}
                render={<Link href={pageHref(1, query, value)} />}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="px-0">
          {clinics.length ? (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="pl-6">Negócio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Agendamentos</TableHead>
                  <TableHead className="pr-6 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinics.map((clinic) => (
                  <TableRow key={clinic.id}>
                    <TableCell className="pl-6">
                      <p className="font-medium">{clinic.name}</p>
                      <p className="text-xs text-muted-foreground">/{clinic.slug}</p>
                    </TableCell>
                    <TableCell>
                      {clinic.deletedAt ? (
                        <Badge variant="destructive">Excluída</Badge>
                      ) : clinic.operationalStatus === "SUSPENDED" ? (
                        <Badge variant="destructive">Suspensa</Badge>
                      ) : (
                        <Badge variant="success">Ativa</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{subscriptionPlanLabel(clinic.subscriptionPlan)}</Badge>
                    </TableCell>
                    <TableCell>{clinic._count.memberships}</TableCell>
                    <TableCell>{clinic._count.customers}</TableCell>
                    <TableCell>{clinic._count.appointments}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/admin/lojas/${clinic.id}`} />}
                      >
                        Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Building2Icon className="size-8 text-muted-foreground" />
              <p className="font-medium">Nenhum negócio encontrado</p>
              <p className="text-sm text-muted-foreground">Altere os filtros ou o termo pesquisado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PaginationNav
        page={page}
        pageCount={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel={total === 1 ? "negócio" : "negócios"}
        hrefForPage={(nextPage) => pageHref(nextPage, query, filter)}
      />
    </>
  );
}
