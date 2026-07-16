import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetch-json";
import type { ServiceListItem } from "@/types";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => fetchJson<ServiceListItem[]>("/api/services"),
  });
}
