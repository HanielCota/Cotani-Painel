"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CustomersPage } from "@/types";

export interface UseCustomersParams {
  search: string;
  page: number;
  pageSize: number;
}

async function fetchCustomers({ search, page, pageSize }: UseCustomersParams): Promise<CustomersPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (search) {
    params.set("search", search);
  }

  const response = await fetch(`/api/customers?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar os clientes.");
  }

  return response.json() as Promise<CustomersPage>;
}

export function useCustomers(params: UseCustomersParams) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
  });
}
