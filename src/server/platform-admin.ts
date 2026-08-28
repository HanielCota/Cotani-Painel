import "server-only";

import { cache } from "react";

import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/server/auth";

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
    (process.env.PLATFORM_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export const getPlatformAdminContext = cache(async (): Promise<PlatformAdminContext | null> => {
  try {
    const user = await requireAuthenticatedUser();
    return getAllowedUserIds().has(user.id) ? { userId: user.id } : null;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return null;
    throw error;
  }
});

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const context = await getPlatformAdminContext();
  if (!context) throw new PlatformAdminAccessError();
  return context;
}
