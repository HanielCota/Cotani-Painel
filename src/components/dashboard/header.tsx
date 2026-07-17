"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/85 px-6 backdrop-blur lg:px-8">
      <SidebarTrigger className="size-11 md:hidden" />
      <div className="ml-auto flex min-w-0 items-center gap-1.5 min-[420px]:gap-2.5">
        <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="outline" className="hidden sm:inline-flex">
          Abrir agenda
        </Button>
        <div className="hidden min-[420px]:block">
          {/* Modo invite-only: organizações são provisionadas via API após o
              pagamento — o switcher é estritamente de seleção, sem ações. */}
          <OrganizationSwitcher hidePersonal appearance={{ elements: { organizationSwitcherPopoverActions: "hidden" } }} />
        </div>
        <UserButton />
      </div>
    </header>
  );
}
