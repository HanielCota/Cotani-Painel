import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  label: string;
  /** Quantidade de cartões de indicador no topo (0 para nenhum). */
  stats?: number;
  /** `list`: barra de filtros + linhas; `panels`: blocos de gráfico/conteúdo. */
  body?: "list" | "panels";
}

/** Esqueleto que reproduz a estrutura real da página durante o carregamento. */
export function PageSkeleton({ label, stats = 0, body = "panels" }: PageSkeletonProps) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={label} role="status">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-80" />
      </div>
      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
        </div>
      ) : null}
      {body === "list" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-full max-w-72" />
            <Skeleton className="h-10 w-32" />
          </div>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14" />)}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
