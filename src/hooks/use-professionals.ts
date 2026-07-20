import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { ProfessionalListItem } from "@/types";

export function useProfessionals() {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals"),
  });
}
