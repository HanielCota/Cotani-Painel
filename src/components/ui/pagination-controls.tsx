"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function PaginationControls({
  page,
  pageCount,
  totalItems,
  onPageChange,
  itemLabel = "item",
}: PaginationControlsProps) {
  if (totalItems <= 15) return null;

  const firstItem = (page - 1) * 15 + 1;
  const lastItem = Math.min(page * 15, totalItems);
  const pluralLabel = itemLabel.endsWith("ção")
    ? `${itemLabel.slice(0, -3)}ções`
    : itemLabel.endsWith("m")
      ? `${itemLabel.slice(0, -1)}ns`
      : itemLabel.endsWith("l")
        ? `${itemLabel.slice(0, -1)}is`
        : `${itemLabel}s`;

  return (
    <nav className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {firstItem}–{lastItem} de {totalItems} {pluralLabel}
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
