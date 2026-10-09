"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, StoreIcon } from "lucide-react";

import { CommandPalette } from "@/components/dashboard/command-palette";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getVisibleNavigation, isActivePath, type NavigationItem } from "@/config/dashboard-navigation";
import type { ClinicRole, SubscriptionPlan } from "@/generated/prisma/enums";
import { clinicRoleLabel } from "@/lib/display-labels";
import { signOut } from "@/server/actions/auth";
import { switchActiveClinic } from "@/server/actions/clinics";

export { isActivePath } from "@/config/dashboard-navigation";

interface SidebarIdentity {
  name: string;
  email: string | null;
}

interface SidebarClinic {
  id: string;
  name: string;
}

interface AppSidebarProps {
  subscriptionPlan?: SubscriptionPlan | null;
  role?: ClinicRole;
  user: SidebarIdentity;
  clinics: SidebarClinic[];
  activeClinicId?: string | null;
  /** Sem negócio ativo não há agenda para notificar. */
  showNotifications?: boolean;
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function BrandMark() {
  return (
    <Link href="/dashboard" aria-label="Cotani - Visão geral" className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center">
      <Image src="/images/cotani-favicon.png" alt="" width={36} height={36} priority className="size-9 shrink-0 transition-[width,height] group-data-[collapsible=icon]:size-8" />
      <span className="truncate text-lg font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">Cotani</span>
    </Link>
  );
}

/** Seletor de loja ativa. Com uma só loja vira apenas identificação. */
function ClinicSwitcher({ clinics, activeClinicId, role }: { clinics: SidebarClinic[]; activeClinicId?: string | null; role?: ClinicRole }) {
  const activeClinic = clinics.find((clinic) => clinic.id === activeClinicId) ?? clinics[0];
  if (!activeClinic) return null;

  const label = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
        <StoreIcon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-semibold text-sidebar-foreground">{activeClinic.name}</span>
        {role ? <span className="truncate text-xs text-muted-foreground">{clinicRoleLabel(role)}</span> : null}
      </span>
    </>
  );

  if (clinics.length < 2) {
    return <div className="flex h-12 items-center gap-2 rounded-lg px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0" title={activeClinic.name}>{label}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" />}
        aria-label={`Trocar de negócio. Negócio atual: ${activeClinic.name}`}
      >
        {label}
        <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Trocar de negócio</DropdownMenuLabel>
          {clinics.map((clinic) => {
            const isActive = clinic.id === activeClinic.id;
            return (
              <form action={switchActiveClinic} key={clinic.id}>
                <input type="hidden" name="clinicId" value={clinic.id} />
                <DropdownMenuItem render={<button type="submit" />} aria-current={isActive ? "true" : undefined} className="min-h-10 w-full">
                  <span className="truncate">{clinic.name}</span>
                  {isActive ? <CheckIcon className="ml-auto size-4 text-primary" /> : null}
                </DropdownMenuItem>
              </form>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ item }: { item: NavigationItem }) {
  const pathname = usePathname() ?? "";
  const isActive = isActivePath(pathname, item.href, item.exact);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive} tooltip={item.title} className="h-9">
        <Icon />
        <span className="truncate">{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function UserMenu({ user }: { user: SidebarIdentity }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />} aria-label="Abrir menu da conta">
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">{initialsOf(user.name)}</AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-medium">{user.name}</span>
          {user.email ? <span className="truncate text-xs text-muted-foreground">{user.email}</span> : null}
        </span>
        <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-foreground">{user.name}</span>
            {user.email ? <span className="block truncate font-normal">{user.email}</span> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem render={<button type="submit" />} variant="destructive" className="min-h-10 w-full">
            <LogOutIcon aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({ subscriptionPlan, role, user, clinics, activeClinicId, showNotifications = true }: AppSidebarProps) {
  const sections = getVisibleNavigation(role, subscriptionPlan);

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-2">
        {/* Recolhida: logo e botão empilhados no centro. */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-start">
          <BrandMark />
          <SidebarTrigger className="hidden text-muted-foreground hover:text-foreground md:inline-flex" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <ClinicSwitcher clinics={clinics} activeClinicId={activeClinicId} role={role} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1">
        {role ? (
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <CommandPalette sections={sections} canCreateAppointment={role !== "PROVIDER"} canSearchCustomers={role !== "PROVIDER"} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
        {sections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => <NavLink key={item.href} item={item} />)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          {showNotifications ? (
            <SidebarMenuItem>
              <NotificationBell />
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
