import { UserIcon } from "lucide-react";

import type { TopProfessionalData } from "@/server/services/reports";

interface ReportsTopProfessionalsProps {
  professionals: TopProfessionalData[];
}

export function ReportsTopProfessionals({ professionals }: ReportsTopProfessionalsProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-card-foreground">Profissionais em destaque</h3>
      {professionals.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Nenhum atendimento no mês
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {professionals.map((professional) => (
            <div key={professional.name} className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{professional.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{professional.count} atend.</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max((professional.count / professionals[0].count) * 100, 5)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
