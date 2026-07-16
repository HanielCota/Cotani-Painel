"use client";

import type { LucideIcon } from "lucide-react";
import { OrganizationSwitcher } from "@clerk/nextjs";
import {
  CalendarDaysIcon,
  LayoutDashboardIcon,
  ScissorsIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const operationItems: NavigationItem[] = [
  { title: "Visão geral", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Agenda", href: "/dashboard/agenda", icon: CalendarDaysIcon },
  { title: "Clientes", href: "/dashboard/clientes", icon: UsersIcon },
];

const managementItems: NavigationItem[] = [
  { title: "Configurações", href: "/dashboard/configuracoes", icon: SettingsIcon },
];

function NavItems({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={isActive}
              tooltip={item.title}
              className="h-10 rounded-lg px-3 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-sm"
            >
              <Icon className="size-4" />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="inset" className="bg-sidebar/95">
      <SidebarHeader className="px-5 pt-5 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/dashboard" />} size="lg" tooltip="Cotani" className="h-11 rounded-xl px-3 hover:bg-transparent">
              <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <ScissorsIcon />
              </span>
              <span className="font-semibold tracking-tight">Cotani</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-4 pt-4">
        <SidebarGroup className="mx-auto w-full max-w-56 p-0">
          <SidebarGroupLabel className="text-xs text-sidebar-foreground/50">Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={operationItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mx-auto mt-4 w-full max-w-56 p-0">
          <SidebarGroupLabel className="text-xs text-sidebar-foreground/50">Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={managementItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-5">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
          <p className="px-3 text-xs font-medium text-sidebar-foreground/60">Barbearia ativa</p>
          <OrganizationSwitcher hidePersonal />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
