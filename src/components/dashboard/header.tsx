"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

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

export function DashboardHeader() {
  const pageTitle = usePageTitle();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:h-16 sm:px-6 lg:px-8">
      <SidebarTrigger className="size-9 md:hidden" />

      <div className="flex min-w-0 flex-1 items-center md:hidden">
        <span className="truncate text-sm font-semibold">{pageTitle}</span>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          nativeButton={false}
          render={<Link href="/dashboard/agenda" />}
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
        >
          <CalendarDaysIcon className="mr-2 size-4" />
          Abrir agenda
        </Button>

        <div className="hidden min-[420px]:block">
          {/* Modo invite-only: organizações são provisionadas via API após o
              pagamento — o switcher é estritamente de seleção, sem ações. */}
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                organizationSwitcherPopoverActions: "hidden",
                organizationSwitcherTrigger: "h-9 px-3 rounded-md border border-input bg-card hover:bg-muted text-sm",
              },
            }}
          />
        </div>

        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: "size-9 rounded-md border border-input bg-card hover:bg-muted",
            },
          }}
        />
      </div>
    </header>
  );
}
