import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

export interface PlatformAdminContext {
  userId: string;
}

export class PlatformAdminAccessError extends Error {
  constructor() {
    super("Acesso restrito ao administrador da plataforma.");
    this.name = "PlatformAdminAccessError";
  }
}

function getAllowedUserIds(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export const getPlatformAdminContext = cache(async (): Promise<PlatformAdminContext | null> => {
  const { userId } = await auth.protect();
  return getAllowedUserIds().has(userId) ? { userId } : null;
});

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const context = await getPlatformAdminContext();
  if (!context) throw new PlatformAdminAccessError();
  return context;
}
