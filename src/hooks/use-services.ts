import { useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { ServiceListItem } from "@/types";

export function useServices() {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["services", clinicId],
    queryFn: () => fetchJson<ServiceListItem[]>("/api/services"),
  });
}
