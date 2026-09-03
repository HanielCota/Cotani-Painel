import "server-only";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

export interface ExpireSubscriptionsResult {
  trialsExpired: number;
  pastDue: number;
  expired: number;
}

/**
 * Desativa assinaturas expiradas.
 *
 * Marca como INACTIVE todas as lojas cujo `subscriptionExpiresAt` já
 * passou e cujo status ainda é ACTIVE ou PAST_DUE. Essa função é acionada
 * diariamente pelo cron do Vercel.
 */
export async function expireSubscriptions(now = new Date()): Promise<ExpireSubscriptionsResult> {
  const configuredGraceDays = Number(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? 3);
  const graceDays = Number.isInteger(configuredGraceDays) && configuredGraceDays >= 1 && configuredGraceDays <= 30 ? configuredGraceDays : 3;
  const graceCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

  const trialsExpired = await prisma.clinic.updateMany({
    where: {
      trialEndsAt: { lt: now },
      subscriptionStatus: SubscriptionStatus.TRIALING,
      hasPaidOnce: false,
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
  });

  const pastDue = await prisma.clinic.updateMany({
    where: {
      subscriptionExpiresAt: { lt: now },
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });

  await prisma.clinic.updateMany({
    where: { subscriptionExpiresAt: { lte: now }, subscriptionStatus: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: true, deletedAt: null },
    data: { subscriptionStatus: SubscriptionStatus.CANCELED, cancelAtPeriodEnd: false },
  });

  const expired = await prisma.clinic.updateMany({
    where: {
      subscriptionExpiresAt: { lt: graceCutoff },
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
  });

  return { trialsExpired: trialsExpired.count, pastDue: pastDue.count, expired: expired.count };
}
