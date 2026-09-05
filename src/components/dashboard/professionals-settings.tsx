"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { getCoreRowModel, useLegacyTable as useReactTable } from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { UserIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProfessionalFormDialog } from "@/components/dashboard/professional-form-dialog";
import { ProfessionalToggleActive } from "@/components/dashboard/professional-toggle-active";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProfessionals } from "@/hooks/use-professionals";
import { usePagination } from "@/hooks/use-pagination";
import { useServices } from "@/hooks/use-services";
import type { ProfessionalListItem } from "@/types";

export function ProfessionalsSettings() {
  "use no memo";
  const { data: professionals, isPending, isError } = useProfessionals();
  const { data: services } = useServices();
  const pagination = usePagination(professionals ?? []);

  const serviceById = useMemo(() => {
    if (!services) return new Map<string, string>();
    return new Map(services.map((service) => [service.id, service.name]));
  }, [services]);

  const columns = useMemo<ColumnDef<ProfessionalListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Profissional",
        cell: ({ row, getValue }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.original.imageUrl} alt="" className="size-10 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserIcon className="size-5" />
              </div>
            )}
            <span className={row.original.isActive ? "" : "text-muted-foreground line-through"}>{getValue<string>()}</span>
          </div>
        ),
      },
      {
        id: "services",
        header: "Serviços",
        cell: ({ row }) => {
          const names = row.original.serviceIds.map((id) => serviceById.get(id) ?? "Serviço");

          if (names.length === 0) {
            return <span className="text-sm text-muted-foreground">Nenhum serviço vinculado</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {names.slice(0, 3).map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
              {names.length > 3 ? <Badge variant="outline" className="text-xs">+{names.length - 3}</Badge> : null}
            </div>
          );
        },
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
            <ProfessionalFormDialog professional={row.original} />
            <ProfessionalToggleActive professional={row.original} />
          </div>
        ),
      },
    ],
    [serviceById],
  );

  const table = useReactTable({
    data: pagination.pageItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os profissionais e os serviços que cada um atende.</p>
        <ProfessionalFormDialog />
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
          <AlertTitle>Não foi possível carregar os profissionais</AlertTitle>
          <AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription>
        </Alert>
      ) : null}

      {!isPending && !isError ? (
        <div>
          <div className="overflow-x-auto rounded-xl border border-border/80">
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
                    Nenhum profissional cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={row.original.isActive ? "" : "bg-background/60"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={professionals?.length ?? 0} onPageChange={pagination.setPage} itemLabel="profissional" />
        </div>
      ) : null}
    </div>
  );
}
