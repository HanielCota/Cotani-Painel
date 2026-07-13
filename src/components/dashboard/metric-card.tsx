import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}

export function MetricCard({ title, value, description, icon: Icon }: MetricCardProps) {
  return (
    <Card className="border border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
