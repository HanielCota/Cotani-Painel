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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/hooks/use-customers";
import type { CustomerListItem } from "@/types";

const PAGE_SIZE = 10;

export function CustomersTable() {
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

  const { data, isPending, isError, isFetching } = useCustomers({
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
      { accessorKey: "phone", header: "Telefone" },
      {
        accessorKey: "createdAt",
        header: "Cliente desde",
        cell: ({ getValue }) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(getValue<string>())),
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
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
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
          <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
        </Alert>
      ) : null}

      {!isPending && !isError ? (
        <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
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
