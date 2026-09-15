import "server-only";

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cancelMercadoPagoSubscription } from "@/server/services/mercado-pago";

const DAY = 24 * 60 * 60 * 1000;
const ABANDONED_CHECKOUT_BATCH_SIZE = 50;

function abandonedCheckoutRetentionDays() {
  const configured = Number(process.env.ABANDONED_CHECKOUT_RETENTION_DAYS ?? 30);
  return Number.isInteger(configured) && configured >= 7 && configured <= 90 ? configured : 30;
}

async function redactAbandonedLandingCheckouts(now: Date) {
  const cutoff = new Date(now.getTime() - abandonedCheckoutRetentionDays() * DAY);
  const candidates = await prisma.billingContract.findMany({
    where: {
      checkoutSource: "LANDING",
      checkoutEmail: { not: null },
      activationSentAt: null,
      createdAt: { lt: cutoff },
      clinic: { hasPaidOnce: false, memberships: { none: {} } },
    },
    orderBy: { createdAt: "asc" },
    take: ABANDONED_CHECKOUT_BATCH_SIZE,
    select: { id: true, clinicId: true, remoteId: true, updatedAt: true },
  });

  let redacted = 0;
  for (const candidate of candidates) {
    try {
      if (candidate.remoteId) await cancelMercadoPagoSubscription(candidate.remoteId);
      const changed = await prisma.$transaction(async (tx) => {
        const contract = await tx.billingContract.updateMany({
          where: {
            id: candidate.id,
            updatedAt: candidate.updatedAt,
            checkoutSource: "LANDING",
            checkoutEmail: { not: null },
            activationSentAt: null,
            clinic: { hasPaidOnce: false, memberships: { none: {} } },
          },
          data: {
            checkoutSource: "LANDING_REDACTED",
            checkoutEmail: null,
            checkoutName: null,
            checkoutUrl: null,
            remoteId: null,
            state: "expired",
            activationError: null,
          },
        });
        if (contract.count === 0) return false;

        await tx.clinic.updateMany({
          where: { id: candidate.clinicId, hasPaidOnce: false, memberships: { none: {} } },
          data: {
            name: "Checkout abandonado",
            slug: `checkout-abandonado-${candidate.clinicId}`,
            contactEmail: null,
            phone: null,
            address: null,
            publicDescription: null,
            imageUrl: null,
            pendingSubscriptionPlan: null,
            pendingSubscriptionCycle: null,
            mercadoPagoSubscriptionId: null,
            mercadoPagoCheckoutKey: null,
            mercadoPagoCheckoutStartedAt: null,
            mercadoPagoCheckoutUrl: null,
            deletedAt: now,
          },
        });
        return true;
      });
      if (changed) redacted += 1;
    } catch (error) {
      logger.warn("Falha ao anonimizar checkout abandonado", {
        contractId: candidate.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return redacted;
}

/** Remove dados operacionais vencidos e anonimiza o conteúdo de mensagens. */
export async function runDataMaintenance(now = new Date()) {
  const rateLimitCutoff = new Date(now.getTime() - DAY);
  const notificationCutoff = new Date(now.getTime() - 90 * DAY);
  const webhookCutoff = new Date(now.getTime() - 180 * DAY);

  const redactedAbandonedCheckouts = await redactAbandonedLandingCheckouts(now);
  const [rateLimits, notifications, webhookEvents] = await prisma.$transaction([
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: rateLimitCutoff } } }),
    prisma.notification.updateMany({
      where: { status: { in: ["SENT", "FAILED", "CANCELED"] }, updatedAt: { lt: notificationCutoff } },
      data: { recipient: "[redacted]", content: "[redacted]", error: null, providerRef: null },
    }),
    prisma.webhookEvent.deleteMany({ where: { processedAt: { lt: webhookCutoff } } }),
  ]);

  return {
    redactedAbandonedCheckouts,
    deletedRateLimits: rateLimits.count,
    redactedNotifications: notifications.count,
    deletedWebhookEvents: webhookEvents.count,
  };
}
