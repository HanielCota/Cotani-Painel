"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  itemLabelPlural?: string;
}

export function PaginationControls({
  page,
  pageCount,
  totalItems,
  onPageChange,
  pageSize = 15,
  itemLabelPlural = "itens",
}: PaginationControlsProps) {
  if (totalItems <= pageSize) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {firstItem}–{lastItem} de {totalItems} {itemLabelPlural}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
          Próxima
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
