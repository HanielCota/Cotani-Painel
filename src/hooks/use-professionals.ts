import { useQuery } from "@tanstack/react-query";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import type { ProfessionalListItem } from "@/types";

export function useProfessionals() {
  const clinicId = useActiveClinicId();
  return useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals"),
  });
}
