"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { getCoreRowModel, useLegacyTable as useReactTable } from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ServiceFormDialog } from "@/components/dashboard/service-form-dialog";
import { ServiceToggleActive } from "@/components/dashboard/service-toggle-active";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServices } from "@/hooks/use-services";
import type { ServiceListItem } from "@/types";

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ServicesSettings() {
  "use no memo";
  const { data: services, isPending, isError } = useServices();

  const columns = useMemo<ColumnDef<ServiceListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row, getValue }) => (
          <span className={row.original.isActive ? "" : "text-muted-foreground line-through"}>{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "duration",
        header: "Duração",
        cell: ({ getValue }) => `${getValue<number>()} min`,
      },
      {
        accessorKey: "price",
        header: "Valor",
        cell: ({ getValue }) => priceFormatter.format(getValue<number>()),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ getValue }) =>
          getValue<boolean>() ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <ServiceFormDialog service={row.original} />
            <ServiceToggleActive service={row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  // TanStack Table expõe funções mutáveis; o componente já foi excluído do React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: services ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
        <div className="rounded-lg border overflow-x-auto">
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
                    Nenhum serviço cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={row.original.isActive ? "" : "bg-muted/30"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
