import { Badge } from "@/components/ui/badge";
import type { Clinic } from "@/generated/prisma/client";

type StoreStatus = Pick<Clinic, "deletedAt" | "operationalStatus">;

export function StoreStatusBadge({ clinic }: { clinic: StoreStatus }) {
  if (clinic.deletedAt) {
    return <Badge variant="destructive">Excluída</Badge>;
  }

  if (clinic.operationalStatus === "SUSPENDED") {
    return <Badge variant="destructive">Suspensa</Badge>;
  }

  return <Badge variant="success">Ativa</Badge>;
}
