import type { LucideIcon } from "lucide-react";
import {
  Building2Icon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChartNoAxesCombinedIcon,
  ContactRoundIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  ScissorsIcon,
  SettingsIcon,
  StoreIcon,
  UserCogIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { getPlanEntitlements, type PlanEntitlements } from "@/config/subscription-plans";
import type { ClinicRole, SubscriptionPlan } from "@/generated/prisma/enums";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Não ativa o item em sub-rotas (ex.: `/dashboard` não fica ativo em `/dashboard/agenda`). */
  exact?: boolean;
  /** Papéis que enxergam o item; ausente = todos. */
  roles?: readonly ClinicRole[];
  /** Direito do plano exigido para o item aparecer. */
  entitlement?: keyof PlanEntitlements;
}

export interface NavigationSection {
  title: string;
  items: readonly NavigationItem[];
}

const MANAGERS = ["ADMIN", "RECEPTIONIST"] as const satisfies readonly ClinicRole[];
const ADMIN_ONLY = ["ADMIN"] as const satisfies readonly ClinicRole[];

/**
 * Fonte única do menu do painel. As páginas continuam validando papel e plano
 * no servidor; aqui só se decide o que é exibido.
 */
export const DASHBOARD_NAVIGATION: readonly NavigationSection[] = [
  {
    title: "Operação",
    items: [
      { title: "Visão geral", href: "/dashboard", icon: LayoutDashboardIcon, exact: true, roles: MANAGERS },
      { title: "Agenda", href: "/dashboard/agenda", icon: CalendarDaysIcon },
      { title: "Clientes", href: "/dashboard/clientes", icon: ContactRoundIcon, roles: MANAGERS },
      { title: "Comunicações", href: "/dashboard/comunicacoes", icon: MessageCircleIcon, roles: MANAGERS },
      { title: "Financeiro", href: "/dashboard/financeiro", icon: WalletIcon, roles: ADMIN_ONLY },
      { title: "Relatórios", href: "/dashboard/relatorios", icon: ChartNoAxesCombinedIcon, roles: ADMIN_ONLY, entitlement: "monthlyReports" },
    ],
  },
  {
    title: "Seu negócio",
    items: [
      { title: "Perfil do negócio", href: "/dashboard/negocio", icon: StoreIcon, exact: true, roles: ADMIN_ONLY },
      { title: "Serviços", href: "/dashboard/negocio/servicos", icon: ScissorsIcon, roles: ADMIN_ONLY },
      { title: "Profissionais", href: "/dashboard/negocio/profissionais", icon: UserRoundIcon, roles: ADMIN_ONLY },
      { title: "Horários", href: "/dashboard/negocio/horarios", icon: CalendarClockIcon, roles: ADMIN_ONLY },
      { title: "Equipe e acessos", href: "/dashboard/negocio/equipe", icon: UserCogIcon, roles: ADMIN_ONLY },
      { title: "Unidades", href: "/dashboard/negocio/unidades", icon: Building2Icon, roles: ADMIN_ONLY },
    ],
  },
  {
    title: "Conta",
    items: [
      { title: "Assinatura", href: "/dashboard/assinatura", icon: CreditCardIcon, roles: ADMIN_ONLY },
      { title: "Configurações", href: "/dashboard/minha-conta", icon: SettingsIcon },
    ],
  },
];

export function getVisibleNavigation(role: ClinicRole | undefined, plan: SubscriptionPlan | null | undefined): NavigationSection[] {
  const entitlements = getPlanEntitlements(plan);
  return DASHBOARD_NAVIGATION
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // Sem loja ativa (role indefinido) só a agenda/conta fazem sentido.
        if (item.roles && (!role || !item.roles.includes(role))) return false;
        return !item.entitlement || Boolean(entitlements[item.entitlement]);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Item ativo: rota exata ou sub-rota (exceto itens `exact`). Filtros na query
 * string (ex.: `/dashboard/agenda?status=...`) mantêm o item ativo.
 */
export function isActivePath(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
