import "server-only";

import { SUBSCRIPTION_PLANS, getMercadoPagoPlanEnvKey } from "@/config/subscription-plans";
import { BillingCycle } from "@/generated/prisma/enums";
import type { SubscriptionPlanData } from "@/components/dashboard/subscription-checkout";

export function getSubscriptionPlanOptions(): SubscriptionPlanData[] {
  return Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
    ...plan,
    configuredCycles: ([BillingCycle.MONTHLY, BillingCycle.ANNUAL] as const).filter((cycle) =>
      Boolean(process.env[getMercadoPagoPlanEnvKey(plan.id, cycle)]?.trim()),
    ),
  }));
}
