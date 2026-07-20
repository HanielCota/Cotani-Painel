"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/dashboard": "Visão geral",
  "/dashboard/agenda": "Agenda",
  "/dashboard/clientes": "Clientes",
  "/dashboard/financeiro": "Financeiro",
  "/dashboard/relatorios": "Relatórios",
  "/dashboard/configuracoes": "Configurações",
  "/dashboard/assinatura": "Assinatura",
  "/dashboard/automacoes": "Automações",
  "/dashboard/ai": "IA",
};

function usePageTitle() {
  const pathname = usePathname() ?? "";

  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  const matchingPrefix = Object.keys(pageTitles)
    .filter((key) => key !== "/dashboard")
    .find((key) => pathname.startsWith(`${key}/`));

  return matchingPrefix ? pageTitles[matchingPrefix] : "Painel";
}

export function DashboardHeader({ className }: { className?: string }) {
  const pageTitle = usePageTitle();

  return (
    <header className={cn("flex h-14 w-full shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 shadow-sm sm:h-16 sm:px-6 lg:px-8", className)}>
      <SidebarTrigger className="size-9 md:hidden" />

      <div className="flex min-w-0 flex-1 items-center">
        <span className="truncate text-sm font-semibold text-foreground">{pageTitle}</span>
      </div>
    </header>
  );
}
