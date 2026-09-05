import "server-only";

import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { buildWhatsAppLink } from "@/lib/phone";

export interface WhatsAppNotificationItem {
  id: string;
  kind: string;
  recipient: string;
  content: string;
  scheduledFor: Date;
  attempts: number;
  whatsappLink: string | null;
}

export interface WhatsAppCrmData {
  pending: WhatsAppNotificationItem[];
  sent: WhatsAppNotificationItem[];
}

function toNotificationItem(notification: {
  id: string;
  kind: string;
  recipient: string;
  content: string;
  scheduledFor: Date;
  attempts: number;
}): WhatsAppNotificationItem {
  return {
    id: notification.id,
    kind: notification.kind,
    recipient: notification.recipient,
    content: notification.content,
    scheduledFor: notification.scheduledFor,
    attempts: notification.attempts,
    whatsappLink: buildWhatsAppLink(notification.recipient, notification.content),
  };
}

export async function getWhatsAppCrmData(clinic: ClinicModel, sentLimit = 100): Promise<WhatsAppCrmData> {
  const [pendingNotifications, sentNotifications] = await Promise.all([
    prisma.notification.findMany({
      where: {
        clinicId: clinic.id,
        channel: "WHATSAPP",
        status: "PENDING",
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.notification.findMany({
      where: {
        clinicId: clinic.id,
        channel: "WHATSAPP",
        status: "SENT",
      },
      orderBy: { sentAt: "desc" },
      take: sentLimit,
    }),
  ]);

  return {
    pending: pendingNotifications.map(toNotificationItem),
    sent: sentNotifications.map(toNotificationItem),
  };
}
