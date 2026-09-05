"use client";

import { useState } from "react";

export const DEFAULT_PAGE_SIZE = 15;

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * pageSize;

  return {
    page,
    pageCount,
    pageItems: items.slice(startIndex, startIndex + pageSize),
    setPage: (nextPage: number) => setRequestedPage(Math.min(Math.max(nextPage, 1), pageCount)),
    resetPage: () => setRequestedPage(1),
  };
}
