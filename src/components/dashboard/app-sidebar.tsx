"use client";

import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Building2Icon,
  CalendarClockIcon,
  ChartNoAxesCombinedIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  DollarSignIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  TagIcon,
  StoreIcon,
  UsersIcon,
  Users2Icon,
  UserRoundIcon,
  LogOutIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getPlanEntitlements } from "@/config/subscription-plans";
import type { ClinicRole, SubscriptionPlan } from "@/generated/prisma/enums";
import { signOut } from "@/server/actions/auth";
import { switchActiveClinic } from "@/server/actions/clinics";

interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

const dashboardItem: NavigationItem = {
  title: "Visão geral",
  href: "/dashboard",
  icon: LayoutDashboardIcon,
  exact: true,
};

const operationItems: NavigationItem[] = [
  { title: "Agenda", href: "/dashboard/agenda", icon: CalendarDaysIcon },
  { title: "Clientes", href: "/dashboard/clientes", icon: UsersIcon },
  { title: "Comunicações", href: "/dashboard/comunicacoes", icon: MessageCircleIcon },
  { title: "Financeiro", href: "/dashboard/financeiro", icon: DollarSignIcon },
  { title: "Relatórios", href: "/dashboard/relatorios", icon: ChartNoAxesCombinedIcon },
];

const storeItems: NavigationItem[] = [
  { title: "Visão do negócio", href: "/dashboard/negocio", icon: StoreIcon, exact: true },
  { title: "Serviços", href: "/dashboard/negocio/servicos", icon: TagIcon },
  { title: "Profissionais", href: "/dashboard/negocio/profissionais", icon: Users2Icon },
  { title: "Horários", href: "/dashboard/negocio/horarios", icon: CalendarClockIcon },
  { title: "Equipe", href: "/dashboard/negocio/equipe", icon: UsersIcon },
  { title: "Unidades", href: "/dashboard/negocio/unidades", icon: Building2Icon },
];

const accountItems: NavigationItem[] = [
  { title: "Assinatura", href: "/dashboard/assinatura", icon: CreditCardIcon },
  { title: "Minha conta", href: "/dashboard/minha-conta", icon: UserRoundIcon },
];

/**
 * Determina se um item de navegação está ativo.
 * - Match exato do pathname com o href (sem query string).
 * - Para itens de sub-rota, ativa também quando pathname começa com "href/".
 * - Itens marcados como exatos não são ativados por sub-rotas.
 * - Itens com query string só ficam ativos quando pathname e searchParams batem.
 * - Itens sem query string só ficam ativos quando a URL atual também não possui
 *   query string, evitando que múltiplos itens fiquem ativos ao mesmo tempo.
 */
export function isActivePath(pathname: string, searchParams: URLSearchParams, href: string, exact = false): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  const hrefSearchParams = new URLSearchParams(hrefQuery ?? "");

  const pathMatches = pathname === hrefPath || (!exact && pathname.startsWith(`${hrefPath}/`));
  if (!pathMatches) return false;

  // Um link sem query string não fica ativo quando a URL possui filtros próprios.
  if (!hrefQuery && searchParams.toString()) {
    return false;
  }

  if (hrefQuery) {
    for (const [key, value] of hrefSearchParams) {
      if (searchParams.get(key) !== value) return false;
    }
  }

  return true;
}

function NavLink({ item }: { item: NavigationItem }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isActive = isActivePath(pathname, searchParams, item.href, item.exact);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={isActive}
        tooltip={item.title}
        className={cn(
          "h-10 rounded-lg px-3 text-sm no-underline transition-colors",
          "hover:bg-muted hover:text-foreground hover:no-underline",
          isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface SidebarIdentity {
  name: string;
  email: string | null;
}

interface SidebarClinic {
  id: string;
  name: string;
}

function ProfileCompanyCard({ user, clinics, activeClinicId }: { user: SidebarIdentity; clinics: SidebarClinic[]; activeClinicId?: string | null }) {
  const { state } = useSidebar();
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  const activeClinic = clinics.find((clinic) => clinic.id === activeClinicId) ?? clinics[0];

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Abrir menu da conta" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Avatar className="size-9 border border-input">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm text-foreground">{user.name}</span>
            <span className="block truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={signOut}><DropdownMenuItem render={<button type="submit" />} variant="destructive" className="min-h-10 w-full px-2 py-2"><LogOutIcon aria-hidden="true" className="size-4" />Sair</DropdownMenuItem></form>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (state === "collapsed") {
    return <div className="mt-4 flex justify-center">{profileMenu}</div>;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        {profileMenu}
        {activeClinic ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Trocar de loja. Loja atual: ${activeClinic.name}`} className="h-10 min-w-0 flex-1 truncate rounded-lg border border-input bg-background px-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {activeClinic.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Trocar de loja</DropdownMenuLabel>
                {clinics.map((clinic) => (
                  <form action={switchActiveClinic} key={clinic.id}>
                    <input type="hidden" name="clinicId" value={clinic.id} />
                    <DropdownMenuItem render={<button type="submit" />} aria-current={clinic.id === activeClinic.id ? "true" : undefined} className={`min-h-10 w-full px-2 py-2 ${clinic.id === activeClinic.id ? "font-semibold text-primary" : ""}`}>
                      {clinic.name}
                    </DropdownMenuItem>
                  </form>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Button
        nativeButton={false}
        render={<Link href="/dashboard/agenda" />}
        className="w-full justify-center bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <CalendarDaysIcon data-icon="inline-start" />
        Abrir agenda
      </Button>
    </div>
  );
}

function useBottomShadow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const element = ref.current;
    const sentinel = sentinelRef.current;
    if (!element || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { root: element, threshold: 0 },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, sentinelRef, isAtBottom };
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
        {title}
      </span>
      {children}
    </div>
  );
}

export function AppSidebar({ subscriptionPlan, role, user, clinics, activeClinicId }: { subscriptionPlan?: SubscriptionPlan | null; role?: ClinicRole; user: SidebarIdentity; clinics: SidebarClinic[]; activeClinicId?: string | null }) {
  const { ref: contentRef, sentinelRef, isAtBottom } = useBottomShadow<HTMLDivElement>();
  const showShadow = !isAtBottom;
  const entitlements = getPlanEntitlements(subscriptionPlan);
  const visibleOperationItems = operationItems.filter((item) => {
    if (role === "PROVIDER") return item.href === "/dashboard/agenda";
    if (role === "RECEPTIONIST" && ["/dashboard/financeiro", "/dashboard/relatorios"].includes(item.href)) return false;
    if (item.href === "/dashboard/relatorios") return entitlements.monthlyReports;
    return true;
  });

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="top-0 h-svh border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="overflow-hidden px-4 pt-5 pb-3 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex max-w-44 min-w-0 items-center gap-2 overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-300 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2Icon className="size-5" />
            </div>
            <span className="truncate text-lg font-bold tracking-tight text-foreground">
              Cotani
            </span>
          </div>
          <SidebarTrigger className="size-8 shrink-0 text-muted-foreground hover:text-foreground" />
        </div>
        <ProfileCompanyCard user={user} clinics={clinics} activeClinicId={activeClinicId} />
      </SidebarHeader>

      <SidebarContent ref={contentRef} className="relative flex flex-col gap-5 px-3 py-4">
        <NavSection title="Operação">
          <SidebarMenu className="gap-1">
            {role !== "PROVIDER" ? <NavLink item={dashboardItem} /> : null}
            {visibleOperationItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </SidebarMenu>
        </NavSection>

        {role === "ADMIN" ? <NavSection title="Seu negócio">
          <SidebarMenu className="gap-1">
            {storeItems.map((item) => <NavLink key={item.href} item={item} />)}
          </SidebarMenu>
        </NavSection> : null}

        <NavSection title="Conta">
          <SidebarMenu className="gap-1">
            {accountItems.filter((item) => role === "ADMIN" || item.href !== "/dashboard/assinatura").map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </SidebarMenu>
        </NavSection>

        <div ref={sentinelRef} aria-hidden className="h-px w-full shrink-0" />

        <div
          aria-hidden
          data-visible={showShadow}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity data-[visible=true]:opacity-100"
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton
                type="submit"
                tooltip="Sair"
                className="h-10 rounded-lg border border-destructive/20 bg-destructive/10 px-3 text-destructive transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive/30"
              >
                <LogOutIcon className="size-4 shrink-0" />
                <span className="truncate">Sair</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
