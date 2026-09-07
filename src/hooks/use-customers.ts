"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
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

  return fetchJson<CustomersPage>(`/api/customers?${params.toString()}`);
}

export function useCustomers(params: UseCustomersParams) {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["customers", clinicId, params],
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
    retry: 2,
  });
}
