"use client";

import { useMemo } from "react";
import { UserIcon } from "lucide-react";

import { ProfessionalFormDialog } from "@/components/dashboard/professional-form-dialog";
import { ProfessionalToggleActive } from "@/components/dashboard/professional-toggle-active";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { useProfessionals } from "@/hooks/use-professionals";
import { useServices } from "@/hooks/use-services";
import type { ProfessionalListItem } from "@/types";

function ProfessionalAvatar({ professional }: { professional: ProfessionalListItem }) {
  return (
    <Avatar size="lg">
      {professional.imageUrl ? <AvatarImage src={professional.imageUrl} alt="" /> : null}
      <AvatarFallback><UserIcon aria-hidden="true" className="size-5" /></AvatarFallback>
    </Avatar>
  );
}

function ServiceBadges({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-sm text-muted-foreground">Nenhum serviço vinculado</span>;
  return <div className="flex flex-wrap gap-1">{names.slice(0, 3).map((name, index) => <Badge key={`${name}-${index}`} variant="secondary" className="text-xs">{name}</Badge>)}{names.length > 3 ? <Badge variant="outline" className="text-xs">+{names.length - 3}</Badge> : null}</div>;
}

export function ProfessionalsSettings() {
  const { data: professionals, isPending, isError } = useProfessionals();
  const { data: services } = useServices();
  const pagination = usePagination(professionals ?? []);
  const serviceById = useMemo(
    () => new Map((services ?? []).map((service) => [service.id, service.name])),
    [services],
  );

  function serviceNames(professional: ProfessionalListItem) {
    return professional.serviceIds.map((id) => serviceById.get(id) ?? "Serviço");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os profissionais e os serviços que cada um atende.</p>
        <ProfessionalFormDialog />
      </div>

      {isPending ? <div className="flex flex-col gap-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : null}
      {!isPending && isError ? <Alert variant="destructive"><AlertTitle>Não foi possível carregar os profissionais</AlertTitle><AlertDescription>Verifique sua conexão e tente novamente em instantes.</AlertDescription></Alert> : null}

      {!isPending && !isError ? (
        <div>
          <div className="hidden overflow-x-auto rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Profissional</TableHead><TableHead>Serviços</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {pagination.pageItems.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum profissional cadastrado.</TableCell></TableRow> : pagination.pageItems.map((professional) => (
                  <TableRow key={professional.id} className={professional.isActive ? "" : "bg-background/60"}>
                    <TableCell><div className="flex items-center gap-3"><ProfessionalAvatar professional={professional} /><span className={professional.isActive ? "font-medium" : "text-muted-foreground line-through"}>{professional.name}</span></div></TableCell>
                    <TableCell><ServiceBadges names={serviceNames(professional)} /></TableCell>
                    <TableCell>{professional.isActive ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell><div className="flex justify-end gap-2"><ProfessionalFormDialog professional={professional} /><ProfessionalToggleActive professional={professional} /></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {pagination.pageItems.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum profissional cadastrado.</p> : pagination.pageItems.map((professional) => (
              <article key={professional.id} className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-start gap-3"><ProfessionalAvatar professional={professional} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className={professional.isActive ? "font-medium" : "text-muted-foreground line-through"}>{professional.name}</h3>{professional.isActive ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</div><div className="mt-2"><ServiceBadges names={serviceNames(professional)} /></div></div></div>
                <div className="mt-4 flex justify-end gap-2"><ProfessionalFormDialog professional={professional} /><ProfessionalToggleActive professional={professional} /></div>
              </article>
            ))}
          </div>

          <PaginationControls page={pagination.page} pageCount={pagination.pageCount} totalItems={professionals?.length ?? 0} onPageChange={pagination.setPage} itemLabelPlural="profissionais" />
        </div>
      ) : null}
    </div>
  );
}
