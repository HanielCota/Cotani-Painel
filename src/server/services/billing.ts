import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

export interface ExpireSubscriptionsResult {
  pastDue: number;
  expired: number;
}

/**
 * Desativa assinaturas expiradas.
 *
 * Marca como INACTIVE todas as barbearias cujo `subscriptionExpiresAt` já
 * passou e cujo status ainda é ACTIVE ou PAST_DUE. Essa função é acionada
 * diariamente pelo cron do Vercel.
 */
export async function expireSubscriptions(now = new Date()): Promise<ExpireSubscriptionsResult> {
  const graceDays = Math.max(1, Number(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? 3));
  const graceCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

  const pastDue = await prisma.clinic.updateMany({
    where: {
      subscriptionExpiresAt: { lt: now },
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });

  const expired = await prisma.clinic.updateMany({
    where: {
      subscriptionExpiresAt: { lt: graceCutoff },
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
  });

  return { pastDue: pastDue.count, expired: expired.count };
}
