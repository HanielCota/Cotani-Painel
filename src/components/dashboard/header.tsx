"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { CalendarDaysIcon } from "lucide-react";
import Link from "next/link";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-background/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <SidebarTrigger className="size-10 md:hidden" />

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
