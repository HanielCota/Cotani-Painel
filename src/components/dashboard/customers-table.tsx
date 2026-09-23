"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { DeleteCustomerDialog } from "@/components/dashboard/delete-customer-dialog";
import { EditCustomerDialog } from "@/components/dashboard/edit-customer-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/hooks/use-customers";
import { readUrlSearchParam, replaceUrlSearchParams } from "@/lib/browser-url";
import { formatDate } from "@/lib/formatters";
import { formatBrazilianPhone } from "@/lib/phone";
import type { CustomerListItem } from "@/types";

const PAGE_SIZE = 15;
const relationshipLabels = {
  NEW: "Novo",
  ACTIVE: "Ativo",
  RECURRING: "Recorrente",
  INACTIVE: "Inativo há 60+ dias",
} as const;

function RelationshipBadge({ customer }: { customer: CustomerListItem }) {
  return (
    <Badge variant={customer.relationship === "INACTIVE" ? "secondary" : customer.relationship === "RECURRING" ? "success" : "outline"}>
      {relationshipLabels[customer.relationship]}
    </Badge>
  );
}

function CustomerActions({ customer }: { customer: CustomerListItem }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button nativeButton={false} size="sm" variant="ghost" render={<Link href={`/dashboard/clientes/${customer.id}`} />}>Ver histórico</Button>
      <EditCustomerDialog customer={customer} />
      <DeleteCustomerDialog customerId={customer.id} customerName={customer.name} />
    </div>
  );
}

export function CustomersTable() {
  const initialSearch = readUrlSearchParam("busca");
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPageState] = useState(() => Math.max(1, Number.parseInt(readUrlSearchParam("pagina", "1"), 10) || 1));

  function setPage(nextPage: number) {
    setPageState(nextPage);
    replaceUrlSearchParams({ pagina: nextPage > 1 ? String(nextPage) : null });
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPageState(1);
      replaceUrlSearchParams({ busca: search.trim() || null, pagina: null });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending, isError, isFetching, failureCount, refetch } = useCustomers({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar clientes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou telefone" className="pl-8" />
      </div>

      {isPending ? <div className="flex flex-col gap-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : null}
      {!isPending && isError && !data ? <Alert variant="destructive"><AlertTitle>Não foi possível carregar os clientes</AlertTitle><AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><span>Verifique sua conexão. Seus dados continuam preservados.</span><Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></AlertDescription></Alert> : null}

      {data && failureCount > 0 ? <Alert><AlertTitle>Não foi possível atualizar agora</AlertTitle><AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><span>Você ainda está vendo os últimos dados carregados. A nova tentativa acontece automaticamente.</span><Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></AlertDescription></Alert> : null}

      {!isPending && data ? (
        <div className={isFetching ? "min-w-0 opacity-60 transition-opacity" : "min-w-0 transition-opacity"} aria-busy={isFetching}>
          <div className="hidden max-w-full overflow-x-auto rounded-xl border border-border/70 lg:block">
            <Table>
              <TableHeader className="bg-muted/40"><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Telefone</TableHead><TableHead>Relacionamento</TableHead><TableHead>Atendimentos</TableHead><TableHead>Último atendimento</TableHead><TableHead>Próximo retorno</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {items.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{debouncedSearch ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado."}</TableCell></TableRow> : items.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email ?? "-"}</TableCell>
                    <TableCell>{formatBrazilianPhone(customer.phone)}</TableCell>
                    <TableCell><RelationshipBadge customer={customer} /></TableCell>
                    <TableCell className="tabular-nums">{customer.appointmentCount}</TableCell>
                    <TableCell>{customer.lastAppointmentAt ? <div><p>{formatDate(customer.lastAppointmentAt)}</p><p className="max-w-40 truncate text-xs text-muted-foreground">{customer.lastServiceName}</p></div> : "-"}</TableCell>
                    <TableCell>{customer.nextReturnAt ? formatDate(customer.nextReturnAt) : "-"}</TableCell>
                    <TableCell><CustomerActions customer={customer} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {items.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{debouncedSearch ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado."}</p> : items.map((customer) => (
              <article key={customer.id} className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-medium">{customer.name}</h3><p className="truncate text-sm text-muted-foreground">{customer.email ?? formatBrazilianPhone(customer.phone)}</p></div><RelationshipBadge customer={customer} /></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Atendimentos</dt><dd className="font-medium tabular-nums">{customer.appointmentCount}</dd></div><div><dt className="text-muted-foreground">Último atendimento</dt><dd className="font-medium">{customer.lastAppointmentAt ? formatDate(customer.lastAppointmentAt) : "-"}</dd></div></dl>
                <div className="mt-4 border-t pt-3"><CustomerActions customer={customer} /></div>
              </article>
            ))}
          </div>

          <PaginationControls page={page} pageCount={pageCount} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabelPlural="clientes" />
        </div>
      ) : null}
    </div>
  );
}
