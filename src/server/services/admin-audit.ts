import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import type { PlatformAdminContext } from "@/server/platform-admin";

export interface AdminAuditInput {
  action: string;
  targetType: string;
  targetId: string;
  clinicId?: string | null;
  reason?: string | null;
  beforeSnapshot?: Prisma.InputJsonValue;
  afterSnapshot?: Prisma.InputJsonValue;
}

export async function getAdminRequestMetadata() {
  const requestHeaders = await headers();
  return {
    requestId: requestHeaders.get("x-vercel-id") ?? requestHeaders.get("x-request-id"),
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

export async function writeAdminAuditLog(
  transaction: Prisma.TransactionClient,
  actor: PlatformAdminContext,
  input: AdminAuditInput,
) {
  const metadata = await getAdminRequestMetadata();
  await transaction.adminAuditLog.create({
    data: {
      actorAuthUserId: actor.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      clinicId: input.clinicId,
      reason: input.reason,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      requestId: metadata.requestId,
      ipAddress: metadata.ipAddress,
    },
  });
}
