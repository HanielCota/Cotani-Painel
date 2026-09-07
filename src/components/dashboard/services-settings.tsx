"use client";

import { ServiceFormDialog } from "@/components/dashboard/service-form-dialog";
import { ServiceToggleActive } from "@/components/dashboard/service-toggle-active";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { useServices } from "@/hooks/use-services";
import { formatCurrency } from "@/lib/formatters";

export function ServicesSettings() {
  const { data: services, isPending, isError } = useServices();
  const pagination = usePagination(services ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os serviços disponíveis para agendamento.</p>
        <ServiceFormDialog />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {!isPending && isError ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar os serviços</AlertTitle>
          <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
        </Alert>
      ) : null}

      {!isPending && !isError ? (
        <div>
          <div className="hidden overflow-x-auto rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.pageItems.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum serviço cadastrado.</TableCell></TableRow>
                ) : pagination.pageItems.map((service) => (
                  <TableRow key={service.id} className={service.isActive ? "" : "bg-background/60"}>
                    <TableCell className={service.isActive ? "font-medium" : "text-muted-foreground line-through"}>{service.name}</TableCell>
                    <TableCell>{service.duration} min</TableCell>
                    <TableCell>{formatCurrency(service.price)}</TableCell>
                    <TableCell>{service.isActive ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell><div className="flex justify-end gap-2"><ServiceFormDialog service={service} /><ServiceToggleActive service={service} /></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {pagination.pageItems.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum serviço cadastrado.</p> : pagination.pageItems.map((service) => (
              <article key={service.id} className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className={service.isActive ? "font-medium" : "text-muted-foreground line-through"}>{service.name}</h3><p className="mt-1 text-sm text-muted-foreground">{service.duration} min · {formatCurrency(service.price)}</p></div>
                  {service.isActive ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </div>
                <div className="mt-4 flex justify-end gap-2"><ServiceFormDialog service={service} /><ServiceToggleActive service={service} /></div>
              </article>
            ))}
          </div>

          <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={services?.length ?? 0} onPageChange={pagination.setPage} itemLabelPlural="serviços" />
        </div>
      ) : null}
    </div>
  );
}
