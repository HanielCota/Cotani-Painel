"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Building2Icon,
  CalendarDaysIcon,
  CreditCardIcon,
  DollarSignIcon,
  LayoutDashboardIcon,
  LinkIcon,
  MessageCircleIcon,
  SettingsIcon,
  SparklesIcon,
  StoreIcon,
  UsersIcon,
  Users2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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

interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const dashboardItem: NavigationItem = {
  title: "Visão geral",
  href: "/dashboard",
  icon: LayoutDashboardIcon,
};

const operationItems: NavigationItem[] = [
  { title: "Agenda", href: "/dashboard/agenda", icon: CalendarDaysIcon },
  { title: "Clientes", href: "/dashboard/clientes", icon: UsersIcon },
  { title: "Comunicações", href: "/dashboard/comunicacoes", icon: MessageCircleIcon },
  { title: "Financeiro", href: "/dashboard/financeiro", icon: DollarSignIcon },
];

const storeItems: NavigationItem[] = [
  { title: "Serviços", href: "/dashboard/configuracoes?tab=services", icon: SparklesIcon },
  { title: "Profissionais", href: "/dashboard/configuracoes?tab=profissionais", icon: Users2Icon },
  { title: "Horários", href: "/dashboard/configuracoes?tab=business-hours", icon: CalendarDaysIcon },
];

const accountItems: NavigationItem[] = [
  { title: "Assinatura", href: "/dashboard/assinatura", icon: CreditCardIcon },
  { title: "Configurações", href: "/dashboard/configuracoes", icon: SettingsIcon },
];

/**
 * Determina se um item de navegação está ativo.
 * - Match exato do pathname com o href (sem query string).
 * - Para itens de sub-rota, ativa também quando pathname começa com "href/".
 * - A rota raiz "/dashboard" nunca é ativada por sub-rotas.
 * - Itens com query string só ficam ativos quando pathname e searchParams batem.
 * - Itens sem query string só ficam ativos quando a URL atual também não possui
 *   query string, evitando que múltiplos itens fiquem ativos ao mesmo tempo.
 */
export function isActivePath(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  const hrefSearchParams = new URLSearchParams(hrefQuery ?? "");

  const pathMatches = pathname === hrefPath || (hrefPath !== "/dashboard" && pathname.startsWith(`${hrefPath}/`));
  if (!pathMatches) return false;

  // href sem query string não deve ficar ativo em URLs com query string
  // (ex: /dashboard/configuracoes não deve ativar quando ?tab=profissionais).
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
  const isActive = isActivePath(pathname, searchParams, item.href);
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
          isActive && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ProfileCompanyCard() {
  const { state } = useSidebar();

  if (state === "collapsed") {
    return (
      <div className="mt-4 flex justify-center">
        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: "size-9 rounded-lg border border-input bg-card hover:bg-muted",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <UserButton
          appearance={{
            elements: {
              userButtonTrigger: "size-9 rounded-lg border border-input bg-card hover:bg-muted",
            },
          }}
        />
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              organizationSwitcherPopoverActions: "hidden",
              organizationSwitcherTrigger: "h-9 px-3 rounded-lg border border-input bg-card hover:bg-muted text-sm",
            },
          }}
        />
      </div>

      <Button
        nativeButton={false}
        render={<Link href="/dashboard/agenda" />}
        className="w-full justify-center bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <CalendarDaysIcon className="mr-2 size-4" />
        Abrir agenda
      </Button>
    </div>
  );
}

function SubNavLink({ item }: { item: NavigationItem }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isActive = isActivePath(pathname, searchParams, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors no-underline",
        isActive
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function StoreAccordion() {
  return (
    <Accordion defaultValue={["store"]} className="w-full">
      <AccordionItem value="store" className="border-0">
        <AccordionTrigger className="flex h-10 items-center rounded-lg px-3 py-0 text-sm font-normal text-foreground no-underline hover:bg-muted hover:no-underline [&[data-state=open]>svg]:rotate-180">
          <span className="flex items-center gap-3">
            <StoreIcon className="size-4 shrink-0" />
            <span className="truncate">Sua Loja</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0 pt-1 [&_a]:!no-underline">
          <div className="relative flex flex-col mt-1 group-data-[collapsible=icon]:hidden">
            <div className="absolute left-[1.375rem] top-0 bottom-0 w-px bg-border" />
            <div className="flex flex-col gap-1 pl-11 pr-3">
              {storeItems.map((item) => (
                <SubNavLink key={item.title} item={item} />
              ))}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function useBottomShadow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const sentinel = document.createElement("div");
    sentinel.setAttribute("data-scroll-sentinel", "");
    sentinel.className = "absolute bottom-0 left-0 h-px w-px";
    element.appendChild(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { root: element, threshold: 0 },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (sentinel.parentNode === element) {
        element.removeChild(sentinel);
      }
    };
  }, []);

  return { ref, isAtBottom };
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { state } = useSidebar();

  return (
    <div className="flex flex-col gap-1">
      <span className="px-3 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
        {title}
      </span>
      {children}
    </div>
  );
}

export function AppSidebar() {
  const { ref: contentRef, isAtBottom } = useBottomShadow<HTMLDivElement>();
  const showShadow = !isAtBottom;

  return (
    <Sidebar collapsible="icon" variant="inset" className="top-16 h-[calc(100vh-4rem)] border-r border-border/60 bg-sidebar">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2Icon className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
              Cotani
            </span>
          </div>
          <SidebarTrigger className="size-8 text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden" />
        </div>
        <ProfileCompanyCard />
      </SidebarHeader>

      <SidebarContent ref={contentRef} className="relative flex flex-col gap-5 px-3 py-4">
        <NavSection title="Operação">
          <SidebarMenu className="gap-1">
            <NavLink item={dashboardItem} />
            {operationItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </SidebarMenu>
        </NavSection>

        <NavSection title="Sua Loja">
          <SidebarMenu className="gap-1">
            <li>
              <StoreAccordion />
            </li>
          </SidebarMenu>
        </NavSection>

        <NavSection title="Conta">
          <SidebarMenu className="gap-1">
            {accountItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </SidebarMenu>
        </NavSection>

        <div
          aria-hidden
          data-visible={showShadow}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity data-[visible=true]:opacity-100"
        />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
