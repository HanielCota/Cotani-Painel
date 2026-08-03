"use client";

import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, className, width = 120, height = 40 }: SparklineProps) {
  if (data.length < 2) {
    return <div className={cn("h-10 w-[120px]", className)} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const areaPath = `M ${points[0]} L ${points.join(" L ")} L ${padding + chartWidth},${padding + chartHeight} L ${padding},${padding + chartHeight} Z`;
  const linePath = `M ${points[0]} L ${points.join(" L ")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-label="Micrográfico"
      data-testid="sparkline"
    >
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparklineGradient)" />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
