"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { getCoreRowModel, useLegacyTable as useReactTable } from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import { DeleteCustomerDialog } from "@/components/dashboard/delete-customer-dialog";
import { EditCustomerDialog } from "@/components/dashboard/edit-customer-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/hooks/use-customers";
import type { CustomerListItem } from "@/types";

const PAGE_SIZE = 10;

const relationshipLabels = {
  NEW: "Novo",
  ACTIVE: "Ativo",
  RECURRING: "Recorrente",
  INACTIVE: "Inativo há 60+ dias",
} as const;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const countryPrefix = digits.startsWith("55") && digits.length >= 12 ? "+55 " : "";

  if (localDigits.length === 11) {
    return `${countryPrefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }

  if (localDigits.length === 10) {
    return `${countryPrefix}(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  return value;
}

export function CustomersTable() {
  "use no memo";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending, isError, isFetching, refetch } = useCustomers({
    search: debouncedSearch,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  });

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      { accessorKey: "name", header: "Nome" },
      {
        accessorKey: "email",
        header: "E-mail",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      },
      {
        accessorKey: "phone",
        header: "Telefone",
        cell: ({ getValue }) => formatPhone(getValue<string>()),
      },
      {
        accessorKey: "relationship",
        header: "Relacionamento",
        cell: ({ row }) => (
          <Badge variant={row.original.relationship === "INACTIVE" ? "secondary" : row.original.relationship === "RECURRING" ? "success" : "outline"}>
            {relationshipLabels[row.original.relationship]}
          </Badge>
        ),
      },
      {
        accessorKey: "appointmentCount",
        header: "Atendimentos",
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
      },
      {
        accessorKey: "lastAppointmentAt",
        header: "Último atendimento",
        cell: ({ row }) => row.original.lastAppointmentAt ? (
          <div>
            <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(row.original.lastAppointmentAt))}</p>
            <p className="max-w-40 truncate text-xs text-muted-foreground">{row.original.lastServiceName}</p>
          </div>
        ) : "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <EditCustomerDialog customer={row.original} />
            <DeleteCustomerDialog customerId={row.original.id} customerName={row.original.name} />
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    pageCount: data ? Math.ceil(data.total / pagination.pageSize) : 0,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar clientes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone"
          className="pl-8"
        />
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
          <AlertTitle>Não foi possível carregar os clientes</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Verifique sua conexão. Seus dados continuam preservados.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isPending && !isError ? (
        <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <Table>
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                      {debouncedSearch ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.total ?? 0} cliente{(data?.total ?? 0) === 1 ? "" : "s"} · Página {pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                <ChevronLeftIcon data-icon="inline-start" />
                Anterior
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                Próxima
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
