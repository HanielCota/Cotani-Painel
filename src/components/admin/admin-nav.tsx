"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2Icon, GaugeIcon, ScrollTextIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Visão geral", icon: GaugeIcon },
  { href: "/admin/lojas", label: "Lojas", icon: Building2Icon },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollTextIcon },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Administração da plataforma">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
