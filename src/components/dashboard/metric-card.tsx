import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accent?: "default" | "success" | "warning" | "destructive";
}

const accentClasses: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-500",
  warning: "bg-amber-500/10 text-amber-500",
  destructive: "bg-destructive/10 text-destructive",
};

export function MetricCard({ title, value, description, icon: Icon, accent = "default" }: MetricCardProps) {
  return (
    <Card className="border border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentClasses[accent]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
