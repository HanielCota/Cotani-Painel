import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

interface PaginationNavProps {
  page: number
  pageCount: number
  totalItems: number
  pageSize: number
  itemLabel: string
  hrefForPage: (page: number) => string
}

export function PaginationNav({ page, pageCount, totalItems, pageSize, itemLabel, hrefForPage }: PaginationNavProps) {
  if (pageCount <= 1) return null
  const firstItem = (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, totalItems)

  return (
    <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação">
      <p className="text-sm text-muted-foreground">{firstItem}–{lastItem} de {totalItems} {itemLabel}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} nativeButton={page <= 1} render={page > 1 ? <Link href={hrefForPage(page - 1)} /> : undefined}><ChevronLeftIcon data-icon="inline-start" />Anterior</Button>
        <Button size="sm" variant="outline" disabled={page >= pageCount} nativeButton={page >= pageCount} render={page < pageCount ? <Link href={hrefForPage(page + 1)} /> : undefined}>Próxima<ChevronRightIcon data-icon="inline-end" /></Button>
      </div>
    </nav>
  )
}
