import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DashboardCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({ icon: Icon, title, description, children, className }: DashboardCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-card p-6 text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-primary" />
          {title}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto pt-6">{children}</div>
    </div>
  );
}
