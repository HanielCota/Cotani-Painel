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
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  destructive: "bg-destructive/10 text-destructive",
};

export function MetricCard({ title, value, description, icon: Icon, accent = "default" }: MetricCardProps) {
  return (
    <Card className="transition-colors hover:border-primary/20">
      <CardContent className="flex items-center gap-4">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
