import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

export interface ExpireSubscriptionsResult {
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
  const result = await prisma.clinic.updateMany({
    where: {
      subscriptionExpiresAt: { lt: now },
      subscriptionStatus: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      deletedAt: null,
    },
    data: { subscriptionStatus: SubscriptionStatus.INACTIVE },
  });

  return { expired: result.count };
}
