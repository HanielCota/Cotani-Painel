import type { LucideIcon } from "lucide-react";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

const toneClasses: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};

export interface StatTrend {
  label: string;
  direction: "up" | "down" | "flat";
  /** Se subir é bom (receita) ou ruim (cancelamentos). Padrão: subir é bom. */
  upIsGood?: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  trend?: StatTrend;
  /** Conteúdo extra abaixo do valor (ex.: sparkline). */
  children?: React.ReactNode;
  className?: string;
}

function TrendBadge({ trend }: { trend: StatTrend }) {
  const good = trend.direction === "flat" ? null : (trend.direction === "up") === (trend.upIsGood ?? true);
  const Icon = trend.direction === "up" ? ArrowUpRightIcon : trend.direction === "down" ? ArrowDownRightIcon : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        good === null ? "bg-muted text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
      {trend.label}
    </span>
  );
}

/** Indicador numérico padrão (painel, relatórios, financeiro e admin). */
export function StatCard({ title, value, description, icon: Icon, tone = "primary", trend, children, className }: StatCardProps) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon ? (
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneClasses[tone])}>
              <Icon aria-hidden="true" className="size-[1.125rem]" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-[1.75rem] leading-none font-semibold tracking-[-0.04em] tabular-nums text-foreground">{value}</p>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
        {description ? <p className="-mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {children}
      </CardContent>
    </Card>
  );
}
