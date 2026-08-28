import { BillingCycle, NotificationChannel, SubscriptionPlan } from "@/generated/prisma/enums";

export interface PlanEntitlements {
  maxProfessionals: number | null;
  unlimitedAppointments: true;
  whatsapp: true;
  email: true;
  sms: boolean;
  finance: boolean;
  monthlyReports: boolean;
  advancedReports: boolean;
  multipleLocations: boolean;
  integrationApi: boolean;
  prioritySupport: boolean;
}

export interface ProductPlan {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  selfServiceCheckout: boolean;
  entitlements: PlanEntitlements;
  features: readonly string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, ProductPlan> = {
  [SubscriptionPlan.ESSENTIAL]: {
    id: SubscriptionPlan.ESSENTIAL,
    name: "Essencial",
    description: "Para quem atende sozinho e quer confirmações automáticas sem limites na agenda.",
    monthlyPrice: 34.9,
    annualPrice: 335.04,
    selfServiceCheckout: true,
    entitlements: {
      maxProfessionals: 1,
      unlimitedAppointments: true,
      whatsapp: true,
      email: true,
      sms: false,
      finance: false,
      monthlyReports: false,
      advancedReports: false,
      multipleLocations: false,
      integrationApi: false,
      prioritySupport: false,
    },
    features: [
      "1 profissional",
      "Agendamentos ilimitados",
      "Lembretes por WhatsApp e e-mail",
      "Confirmações automáticas",
    ],
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    id: SubscriptionPlan.PROFESSIONAL,
    name: "Profissional",
    description: "Para equipes que precisam automatizar confirmações e acompanhar pagamentos.",
    monthlyPrice: 49.99,
    annualPrice: 479.9,
    selfServiceCheckout: true,
    entitlements: {
      maxProfessionals: 3,
      unlimitedAppointments: true,
      whatsapp: true,
      email: true,
      sms: false,
      finance: true,
      monthlyReports: true,
      advancedReports: false,
      multipleLocations: false,
      integrationApi: false,
      prioritySupport: true,
    },
    features: [
      "Até 3 profissionais",
      "Agendamentos ilimitados",
      "Lembretes por WhatsApp e e-mail",
      "Confirmações automáticas",
      "Controle de pagamentos",
      "Relatórios mensais",
      "Suporte prioritário",
    ],
  },
  [SubscriptionPlan.ENTERPRISE]: {
    id: SubscriptionPlan.ENTERPRISE,
    name: "Empresa",
    description: "Para negócios com múltiplos profissionais ou unidades que precisam de controle centralizado.",
    monthlyPrice: 97.9,
    annualPrice: 939.84,
    selfServiceCheckout: false,
    entitlements: {
      maxProfessionals: null,
      unlimitedAppointments: true,
      whatsapp: true,
      email: true,
      sms: true,
      finance: true,
      monthlyReports: true,
      advancedReports: true,
      multipleLocations: true,
      integrationApi: true,
      prioritySupport: true,
    },
    features: [
      "Profissionais ilimitados",
      "Múltiplas unidades e agendas simultâneas",
      "Agendamentos ilimitados",
      "Lembretes por WhatsApp, SMS e e-mail",
      "Histórico de frequência e controle de faltas",
      "Exportação e relatórios avançados",
      "API de integração",
      "Suporte prioritário dedicado",
    ],
  },
};

export function getProductPlan(plan: SubscriptionPlan): ProductPlan {
  return SUBSCRIPTION_PLANS[plan];
}

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle): number {
  const product = getProductPlan(plan);
  return cycle === BillingCycle.ANNUAL ? product.annualPrice : product.monthlyPrice;
}

export function getMercadoPagoPlanEnvKey(plan: SubscriptionPlan, cycle: BillingCycle): string {
  return `MERCADO_PAGO_${plan}_${cycle}_PLAN_ID`;
}

export function getPlanEntitlements(plan: SubscriptionPlan | null | undefined): PlanEntitlements {
  return SUBSCRIPTION_PLANS[plan ?? SubscriptionPlan.ESSENTIAL].entitlements;
}

export function getNotificationChannels(plan: SubscriptionPlan | null | undefined): NotificationChannel[] {
  const entitlements = getPlanEntitlements(plan);
  return [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, ...(entitlements.sms ? [NotificationChannel.SMS] : [])];
}
