import "server-only";

import { cache } from "react";

import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";

export interface PlatformAdminContext {
  userId: string;
}

export type PlatformAdminAccess =
  | { status: "allowed"; context: PlatformAdminContext }
  | { status: "denied" }
  | { status: "mfa-enrollment-required" }
  | { status: "mfa-challenge-required" };

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

export const getPlatformAdminAccess = cache(async (): Promise<PlatformAdminAccess> => {
  try {
    const user = await requireAuthenticatedUser();
    if (!getAllowedUserIds().has(user.id)) return { status: "denied" };

    const supabase = await createClient();
    const [factors, assurance] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factors.error || assurance.error) return { status: "denied" };
    if (!factors.data?.totp.some((factor) => factor.status === "verified")) {
      return { status: "mfa-enrollment-required" };
    }
    if (assurance.data.currentLevel !== "aal2") {
      return { status: "mfa-challenge-required" };
    }

    return { status: "allowed", context: { userId: user.id } };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { status: "denied" };
    throw error;
  }
});

export const getPlatformAdminContext = cache(async (): Promise<PlatformAdminContext | null> => {
  const access = await getPlatformAdminAccess();
  return access.status === "allowed" ? access.context : null;
});

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const context = await getPlatformAdminContext();
  if (!context) throw new PlatformAdminAccessError();
  return context;
}
