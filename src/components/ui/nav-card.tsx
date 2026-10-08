import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface NavCardProps {
  href: string;
  title: string;
  description?: React.ReactNode;
  icon: LucideIcon;
  className?: string;
}

/** Cartão-link para atalhos de navegação (home, hubs de configuração). */
export function NavCard({ href, title, description, icon: Icon, className }: NavCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 no-underline shadow-card outline-none transition-colors",
        "hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
      </span>
      <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
    </Link>
  );
}
