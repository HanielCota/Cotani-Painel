import prisma from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

/** Remove dados operacionais vencidos e anonimiza o conteúdo de mensagens. */
export async function runDataMaintenance(now = new Date()) {
  const rateLimitCutoff = new Date(now.getTime() - DAY);
  const notificationCutoff = new Date(now.getTime() - 90 * DAY);
  const webhookCutoff = new Date(now.getTime() - 180 * DAY);

  const [rateLimits, notifications, webhookEvents] = await prisma.$transaction([
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: rateLimitCutoff } } }),
    prisma.notification.updateMany({
      where: { status: { in: ["SENT", "FAILED", "CANCELED"] }, updatedAt: { lt: notificationCutoff } },
      data: { recipient: "[redacted]", content: "[redacted]", error: null, providerRef: null },
    }),
    prisma.webhookEvent.deleteMany({ where: { processedAt: { lt: webhookCutoff } } }),
  ]);

  return {
    deletedRateLimits: rateLimits.count,
    redactedNotifications: notifications.count,
    deletedWebhookEvents: webhookEvents.count,
  };
}
