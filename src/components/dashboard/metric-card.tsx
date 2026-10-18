import type { LucideIcon } from "lucide-react";

import { StatCard, type StatTone } from "@/components/ui/stat-card";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accent?: "default" | "success" | "warning" | "destructive";
}

const toneByAccent: Record<NonNullable<MetricCardProps["accent"]>, StatTone> = {
  default: "primary",
  success: "success",
  warning: "warning",
  destructive: "destructive",
};

/** Atalho de `StatCard` mantido para os consumidores existentes. */
export function MetricCard({ accent = "default", ...props }: MetricCardProps) {
  return <StatCard {...props} tone={toneByAccent[accent]} />;
}
