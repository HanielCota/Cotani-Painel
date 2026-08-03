import type { TopServiceData } from "@/server/services/reports";

interface ReportsTopServicesProps {
  services: TopServiceData[];
}

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ReportsTopServices({ services }: ReportsTopServicesProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-card-foreground">Serviços mais vendidos</h3>
      {services.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Nenhuma venda no mês
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {services.map((service, index) => (
            <div key={service.name} className="flex items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{service.name}</span>
                  <span className="text-xs font-semibold text-primary">{service.count}x</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max((service.count / services[0].count) * 100, 5)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{priceFormatter.format(service.revenue)} em receita</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
